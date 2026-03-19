import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { config } from '../config.js'
import { encryptToken, decryptToken } from './auth.service.js'
import type { ConnectedAccountType } from '@axy/shared'

export class AccountService {
  async list(userId: string, type?: ConnectedAccountType) {
    const conditions = [eq(schema.connectedAccounts.userId, userId)]
    if (type) {
      conditions.push(eq(schema.connectedAccounts.type, type))
    }
    const accounts = await db
      .select({
        id: schema.connectedAccounts.id,
        userId: schema.connectedAccounts.userId,
        type: schema.connectedAccounts.type,
        nickname: schema.connectedAccounts.nickname,
        username: schema.connectedAccounts.username,
        isDefault: schema.connectedAccounts.isDefault,
        createdAt: schema.connectedAccounts.createdAt,
        updatedAt: schema.connectedAccounts.updatedAt,
      })
      .from(schema.connectedAccounts)
      .where(and(...conditions))
      .orderBy(schema.connectedAccounts.createdAt)
    return accounts
  }

  async create(userId: string, data: {
    type: ConnectedAccountType
    nickname: string
    token: string
    username?: string
    isDefault?: boolean
  }) {
    const tokenEncrypted = encryptToken(data.token)

    // If setting as default, unset other defaults of same type
    if (data.isDefault) {
      await this.unsetDefaults(userId, data.type)
    }

    // If this is the first account of this type, make it default
    const existing = await db
      .select({ id: schema.connectedAccounts.id })
      .from(schema.connectedAccounts)
      .where(and(
        eq(schema.connectedAccounts.userId, userId),
        eq(schema.connectedAccounts.type, data.type)
      ))
      .limit(1)
    const isDefault = data.isDefault ?? existing.length === 0

    if (isDefault) {
      await this.unsetDefaults(userId, data.type)
    }

    const [account] = await db
      .insert(schema.connectedAccounts)
      .values({
        userId,
        type: data.type,
        nickname: data.nickname,
        tokenEncrypted,
        username: data.username,
        isDefault,
      })
      .returning()

    // Return without tokenEncrypted
    const { tokenEncrypted: _, ...safe } = account
    return safe
  }

  async update(accountId: string, userId: string, data: {
    nickname?: string
    token?: string
    isDefault?: boolean
  }) {
    // Verify ownership
    const [existing] = await db
      .select()
      .from(schema.connectedAccounts)
      .where(and(
        eq(schema.connectedAccounts.id, accountId),
        eq(schema.connectedAccounts.userId, userId)
      ))
      .limit(1)
    if (!existing) return null

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.nickname !== undefined) updates.nickname = data.nickname
    if (data.token !== undefined) updates.tokenEncrypted = encryptToken(data.token)
    if (data.isDefault !== undefined) {
      updates.isDefault = data.isDefault
      if (data.isDefault) {
        await this.unsetDefaults(userId, existing.type)
      }
    }

    const [updated] = await db
      .update(schema.connectedAccounts)
      .set(updates)
      .where(eq(schema.connectedAccounts.id, accountId))
      .returning()

    const { tokenEncrypted: _, ...safe } = updated
    return safe
  }

  async delete(accountId: string, userId: string) {
    // Verify ownership
    const [existing] = await db
      .select()
      .from(schema.connectedAccounts)
      .where(and(
        eq(schema.connectedAccounts.id, accountId),
        eq(schema.connectedAccounts.userId, userId)
      ))
      .limit(1)
    if (!existing) return false

    // Nullify references in projects
    await db
      .update(schema.projects)
      .set({ githubAccountId: null, updatedAt: new Date() })
      .where(eq(schema.projects.githubAccountId, accountId))

    await db
      .update(schema.projects)
      .set({ claudeAccountId: null, updatedAt: new Date() })
      .where(eq(schema.projects.claudeAccountId, accountId))

    await db
      .delete(schema.connectedAccounts)
      .where(eq(schema.connectedAccounts.id, accountId))

    return true
  }

  async getDecryptedToken(accountId: string, userId: string): Promise<string | null> {
    const [account] = await db
      .select({ tokenEncrypted: schema.connectedAccounts.tokenEncrypted, userId: schema.connectedAccounts.userId })
      .from(schema.connectedAccounts)
      .where(and(
        eq(schema.connectedAccounts.id, accountId),
        eq(schema.connectedAccounts.userId, userId)
      ))
      .limit(1)
    if (!account) return null
    try {
      return decryptToken(account.tokenEncrypted)
    } catch {
      return null
    }
  }

  /**
   * Resolve GitHub token: project account -> user default -> legacy users.githubTokenEncrypted
   */
  async resolveGitHubToken(userId: string, projectId?: string): Promise<string | null> {
    // 1. Try project-specific account
    if (projectId) {
      const [project] = await db
        .select({ githubAccountId: schema.projects.githubAccountId })
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)
      if (project?.githubAccountId) {
        const token = await this.getDecryptedToken(project.githubAccountId, userId)
        if (token) return token
      }
    }

    // 2. Try user's default github account
    const [defaultAccount] = await db
      .select({ id: schema.connectedAccounts.id })
      .from(schema.connectedAccounts)
      .where(and(
        eq(schema.connectedAccounts.userId, userId),
        eq(schema.connectedAccounts.type, 'github'),
        eq(schema.connectedAccounts.isDefault, true)
      ))
      .limit(1)
    if (defaultAccount) {
      const token = await this.getDecryptedToken(defaultAccount.id, userId)
      if (token) return token
    }

    // 3. Fallback to legacy users.githubTokenEncrypted
    const [user] = await db
      .select({ githubTokenEncrypted: schema.users.githubTokenEncrypted })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    if (user?.githubTokenEncrypted) {
      try {
        return decryptToken(user.githubTokenEncrypted)
      } catch {
        return null
      }
    }

    return null
  }

  /**
   * Resolve Claude API key: project account -> user default -> process.env.ANTHROPIC_API_KEY
   */
  async resolveClaudeApiKey(userId: string, projectId?: string): Promise<string | null> {
    // 1. Try project-specific account
    if (projectId) {
      const [project] = await db
        .select({ claudeAccountId: schema.projects.claudeAccountId })
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)
      if (project?.claudeAccountId) {
        const token = await this.getDecryptedToken(project.claudeAccountId, userId)
        if (token) return token
      }
    }

    // 2. Try user's default claude_api_key account
    const [defaultAccount] = await db
      .select({ id: schema.connectedAccounts.id })
      .from(schema.connectedAccounts)
      .where(and(
        eq(schema.connectedAccounts.userId, userId),
        eq(schema.connectedAccounts.type, 'claude_api_key'),
        eq(schema.connectedAccounts.isDefault, true)
      ))
      .limit(1)
    if (defaultAccount) {
      const token = await this.getDecryptedToken(defaultAccount.id, userId)
      if (token) return token
    }

    // 3. Fallback to env
    return process.env.ANTHROPIC_API_KEY || null
  }

  private async unsetDefaults(userId: string, type: string) {
    await db
      .update(schema.connectedAccounts)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(
        eq(schema.connectedAccounts.userId, userId),
        eq(schema.connectedAccounts.type, type)
      ))
  }

  async testGitHubToken(token: string): Promise<{ valid: boolean; username?: string }> {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      })
      if (!res.ok) return { valid: false }
      const data = await res.json() as { login: string }
      return { valid: true, username: data.login }
    } catch {
      return { valid: false }
    }
  }

  async testClaudeApiKey(key: string): Promise<{ valid: boolean }> {
    // Simple validation: check key format
    if (!key.startsWith('sk-ant-')) {
      return { valid: false }
    }
    return { valid: true }
  }
}

export const accountService = new AccountService()
