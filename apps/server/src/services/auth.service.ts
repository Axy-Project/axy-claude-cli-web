import { eq, and } from 'drizzle-orm'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { db, schema } from '../db/index.js'
import { generateToken } from '../middleware/auth.js'

// ─── Token encryption helpers (AES-256-GCM) ─────────────────
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey(config.jwtSecret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptToken(ciphertext: string): string {
  const key = deriveKey(config.jwtSecret)
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// ─── Resolve GitHub OAuth credentials (env → DB fallback) ────
async function getGitHubCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  let clientId = config.githubClientId
  let clientSecret = config.githubClientSecret

  // Fallback: read from systemSettings (configured via admin Settings UI)
  if (!clientId) {
    try {
      const [row] = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, 'github_client_id')).limit(1)
      clientId = row?.value || ''
    } catch { /* table may not exist yet */ }
  }
  if (!clientSecret) {
    try {
      const [row] = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, 'github_client_secret_encrypted')).limit(1)
      if (row?.value) clientSecret = decryptToken(row.value)
    } catch { /* table may not exist yet */ }
  }

  return { clientId, clientSecret }
}

export class AuthService {
  /**
   * Get GitHub OAuth authorization URL.
   * Reads credentials from env vars OR from DB (admin Settings UI).
   */
  async getGitHubOAuthUrl(redirectUrl: string): Promise<string> {
    const { clientId } = await getGitHubCredentials()
    if (!clientId) {
      throw new Error('GitHub OAuth not configured. Set Client ID in Settings or GITHUB_CLIENT_ID in .env.')
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: 'repo read:user user:email',
      state: randomBytes(16).toString('hex'),
    })
    return `https://github.com/login/oauth/authorize?${params.toString()}`
  }

  /**
   * Exchange GitHub OAuth code for access token, upsert user in DB.
   */
  async handleGitHubCallback(code: string): Promise<{ token: string; user: any }> {
    const { clientId, clientSecret } = await getGitHubCredentials()
    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth not configured. Set Client ID and Secret in Settings or .env.')
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })

    const tokenData = await tokenRes.json() as {
      access_token?: string
      error?: string
      error_description?: string
    }

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error || 'No access token'}`)
    }

    const githubToken = tokenData.access_token

    // Get GitHub user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    })
    if (!userRes.ok) throw new Error('Failed to get GitHub user info')
    const githubUser = await userRes.json() as {
      id: number
      login: string
      email: string | null
      name: string | null
      avatar_url: string
    }

    // Get primary email if not public
    let email = githubUser.email
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
        },
      })
      if (emailsRes.ok) {
        const emails = await emailsRes.json() as { email: string; primary: boolean; verified: boolean }[]
        const primary = emails.find((e) => e.primary && e.verified)
        email = primary?.email || emails[0]?.email || null
      }
    }

    if (!email) throw new Error('No email found on GitHub account')

    // Use GitHub user ID as the supabaseId field (for backward compatibility with existing users)
    const githubId = `github-${githubUser.id}`

    // Upsert user in our database
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.supabaseId, githubId))
      .limit(1)

    let user: any

    if (existing.length > 0) {
      const [updated] = await db
        .update(schema.users)
        .set({
          email,
          displayName: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubUsername: githubUser.login,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.supabaseId, githubId))
        .returning()
      user = updated
    } else {
      // Check if there's a dev user we should migrate (same email or dev-user-local)
      const devUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.supabaseId, 'dev-user-local'))
        .limit(1)

      if (devUser.length > 0) {
        // Migrate dev user to GitHub OAuth user - preserves all projects/sessions
        const [updated] = await db
          .update(schema.users)
          .set({
            supabaseId: githubId,
            email,
            displayName: githubUser.name || githubUser.login,
            avatarUrl: githubUser.avatar_url,
            githubUsername: githubUser.login,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, devUser[0].id))
          .returning()
        user = updated
      } else {
        // Check if admin requires approval for new users
        const { setupService } = await import('./setup.service.js')
        const requireApproval = (await setupService.getSetting('require_user_approval')) === 'true'

        const [created] = await db
          .insert(schema.users)
          .values({
            supabaseId: githubId,
            email,
            displayName: githubUser.name || githubUser.login,
            avatarUrl: githubUser.avatar_url,
            githubUsername: githubUser.login,
            isApproved: !requireApproval,
          })
          .returning()
        user = created
      }
    }

    // Store GitHub token encrypted (legacy field + connected_accounts)
    const encrypted = encryptToken(githubToken)
    await db
      .update(schema.users)
      .set({ githubTokenEncrypted: encrypted })
      .where(eq(schema.users.id, user.id))

    // Upsert default github account in connected_accounts
    const existingAccounts = await db
      .select()
      .from(schema.connectedAccounts)
      .where(and(
        eq(schema.connectedAccounts.userId, user.id),
        eq(schema.connectedAccounts.type, 'github'),
        eq(schema.connectedAccounts.isDefault, true)
      ))
      .limit(1)

    if (existingAccounts.length > 0) {
      await db
        .update(schema.connectedAccounts)
        .set({
          tokenEncrypted: encrypted,
          username: githubUser.login,
          nickname: githubUser.login,
          updatedAt: new Date(),
        })
        .where(eq(schema.connectedAccounts.id, existingAccounts[0].id))
    } else {
      await db
        .insert(schema.connectedAccounts)
        .values({
          userId: user.id,
          type: 'github',
          nickname: githubUser.login,
          tokenEncrypted: encrypted,
          username: githubUser.login,
          isDefault: true,
        })
    }

    const jwtToken = generateToken(user.id, user.email || email)
    return { token: jwtToken, user }
  }

  /** Dev login - creates a dev user and returns JWT (dev mode only) */
  async devLogin(): Promise<{ token: string; user: any }> {
    if (!config.isDev) throw new Error('Dev login only available in development')

    const devEmail = 'dev@axy.local'
    const devSupabaseId = 'dev-user-local'

    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.supabaseId, devSupabaseId))
      .limit(1)

    let user: any

    if (existing.length > 0) {
      user = existing[0]
    } else {
      const [created] = await db
        .insert(schema.users)
        .values({
          supabaseId: devSupabaseId,
          email: devEmail,
          displayName: 'Dev User',
        })
        .returning()
      user = created
    }

    const token = generateToken(user.id, user.email)
    return { token, user }
  }

  /** Get user by ID */
  async getUserById(userId: string): Promise<any | null> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    return user || null
  }
}

export const authService = new AuthService()
