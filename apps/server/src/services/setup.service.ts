import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import crypto from 'crypto'

// Simple password hashing using scrypt (no bcrypt dependency needed)
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const computed = crypto.scryptSync(password, salt, 64).toString('hex')
  return hash === computed
}

export class SetupService {
  /** Check if initial setup has been completed */
  async isSetupComplete(): Promise<boolean> {
    try {
      const [setting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, 'setup_complete'))
        .limit(1)
      return setting?.value === 'true'
    } catch {
      return false
    }
  }

  /** Get system setting */
  async getSetting(key: string): Promise<string | null> {
    try {
      const [setting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, key))
        .limit(1)
      return setting?.value ?? null
    } catch {
      return null
    }
  }

  /** Set system setting */
  async setSetting(key: string, value: string): Promise<void> {
    const now = new Date()
    try {
      await db.insert(schema.systemSettings).values({ key, value, updatedAt: now })
    } catch {
      // Key exists, update
      await db.update(schema.systemSettings).set({ value, updatedAt: now }).where(eq(schema.systemSettings.key, key))
    }
  }

  /** Create the initial admin user during setup */
  async createAdmin(email: string, password: string, displayName: string): Promise<{ token: string; user: any }> {
    const { generateToken } = await import('../middleware/auth.js')

    const passwordHash = hashPassword(password)
    const userId = crypto.randomUUID()

    const [user] = await db
      .insert(schema.users)
      .values({
        id: userId,
        supabaseId: `local-${userId}`,
        email,
        displayName,
        passwordHash,
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    await this.setSetting('setup_complete', 'true')
    await this.setSetting('auth_method', 'local') // local, github, both

    const token = generateToken(user.id, user.email)
    return { token, user: { id: user.id, email: user.email, displayName: user.displayName, isAdmin: true } }
  }

  /** Login with email/password */
  async loginLocal(email: string, password: string): Promise<{ token: string; user: any } | null> {
    const { generateToken } = await import('../middleware/auth.js')

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)

    if (!user || !user.passwordHash) return null
    if (!verifyPassword(password, user.passwordHash)) return null

    const token = generateToken(user.id, user.email)
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        githubUsername: user.githubUsername,
        isAdmin: user.isAdmin,
      },
    }
  }

  /** Register a new local user (if registration is enabled) */
  async registerLocal(email: string, password: string, displayName: string): Promise<{ token: string; user: any }> {
    const { generateToken } = await import('../middleware/auth.js')

    const passwordHash = hashPassword(password)
    const userId = crypto.randomUUID()

    const [user] = await db
      .insert(schema.users)
      .values({
        id: userId,
        supabaseId: `local-${userId}`,
        email,
        displayName,
        passwordHash,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    const token = generateToken(user.id, user.email)
    return { token, user: { id: user.id, email: user.email, displayName: user.displayName, isAdmin: false } }
  }
}

export const setupService = new SetupService()
