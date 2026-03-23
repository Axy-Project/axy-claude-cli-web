import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { setupService } from '../services/setup.service.js'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'

const router = Router()

/** GET /api/setup/status - Check if setup is complete (NO AUTH) */
router.get('/status', async (_req, res) => {
  try {
    const isComplete = await setupService.isSetupComplete()
    const authMethod = await setupService.getSetting('auth_method')
    res.json({
      success: true,
      data: {
        setupComplete: isComplete,
        authMethod: authMethod || 'none',
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/setup/init - Create initial admin (NO AUTH, only works once) */
router.post('/init', async (req, res) => {
  try {
    const isComplete = await setupService.isSetupComplete()
    if (isComplete) {
      res.status(400).json({ success: false, error: 'Setup already completed' })
      return
    }

    const { email, password, displayName } = req.body
    if (!email || !password || !displayName) {
      res.status(400).json({ success: false, error: 'email, password, and displayName are required' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
      return
    }

    const result = await setupService.createAdmin(email, password, displayName)
    res.status(201).json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/setup/login - Login with email/password (NO AUTH) */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'email and password are required' })
      return
    }

    const { totpCode } = req.body
    const result = await setupService.loginLocal(email, password)
    if (!result) {
      res.status(401).json({ success: false, error: 'Invalid email or password' })
      return
    }

    // Check if 2FA is enabled for this user
    const { db, schema } = await import('../db/index.js')
    const [userRow] = await db.select({ totpEnabled: schema.users.totpEnabled, totpSecretEncrypted: schema.users.totpSecretEncrypted })
      .from(schema.users).where(eq(schema.users.id, result.user.id)).limit(1)

    if (userRow?.totpEnabled && userRow.totpSecretEncrypted) {
      if (!totpCode) {
        res.json({ success: true, data: { requires2FA: true, userId: result.user.id } })
        return
      }
      // Verify TOTP code
      const { TOTP, Secret } = await import('otpauth')
      const { decryptToken } = await import('../services/auth.service.js')
      const secretBase32 = decryptToken(userRow.totpSecretEncrypted)
      const totp = new TOTP({ issuer: 'Axy', label: email, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secretBase32) })
      const delta = totp.validate({ token: totpCode, window: 1 })
      if (delta === null) {
        res.status(403).json({ success: false, error: 'Invalid 2FA code' })
        return
      }
    }

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/setup/complete — Mark setup as complete (called when user finishes or skips Claude step) */
router.post('/complete', async (_req, res) => {
  try {
    await setupService.setSetting('setup_complete', 'true')
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ─── Admin endpoints (require auth) ─────────────────────

/** PUT /api/setup/github-oauth — Save GitHub OAuth credentials */
router.put('/github-oauth', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { clientId, clientSecret, requireApproval } = req.body
    if (clientId !== undefined) await setupService.setSetting('github_client_id', clientId)
    if (clientSecret !== undefined) {
      const { encryptToken } = await import('../services/auth.service.js')
      await setupService.setSetting('github_client_secret_encrypted', encryptToken(clientSecret))
    }
    if (requireApproval !== undefined) await setupService.setSetting('require_user_approval', requireApproval ? 'true' : 'false')
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/setup/github-oauth — Get GitHub OAuth config (masked) */
router.get('/github-oauth', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const clientId = await setupService.getSetting('github_client_id')
    const hasSecret = !!(await setupService.getSetting('github_client_secret_encrypted'))
    const requireApproval = (await setupService.getSetting('require_user_approval')) === 'true'
    res.json({ success: true, data: { clientId: clientId || '', isConfigured: !!clientId && hasSecret, requireApproval } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/setup/pending-users — List users pending approval */
router.get('/pending-users', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const { db, schema } = await import('../db/index.js')
    const pending = await db.select().from(schema.users).where(eq(schema.users.isApproved, false))
    res.json({ success: true, data: pending.map((u: any) => ({
      id: u.id, email: u.email, displayName: u.displayName,
      avatarUrl: u.avatarUrl, githubUsername: u.githubUsername, createdAt: u.createdAt,
    })) })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/setup/approve-user — Approve a pending user */
router.post('/approve-user', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.body
    const { db, schema } = await import('../db/index.js')
    await db.update(schema.users).set({ isApproved: true }).where(eq(schema.users.id, userId))
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/setup/reject-user — Reject and delete a pending user */
router.post('/reject-user', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.body
    const { db, schema } = await import('../db/index.js')
    await db.delete(schema.users).where(eq(schema.users.id, userId))
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/setup/users — List all users (admin only) */
router.get('/users', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { db, schema } = await import('../db/index.js')
    const allUsers = await db.select().from(schema.users)
    res.json({ success: true, data: allUsers.map((u: any) => ({
      id: u.id, email: u.email, displayName: u.displayName,
      avatarUrl: u.avatarUrl, githubUsername: u.githubUsername,
      isAdmin: u.isAdmin, isApproved: u.isApproved, createdAt: u.createdAt,
    })) })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PATCH /api/setup/users/:id — Update user role/approval (admin only) */
router.patch('/users/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { isAdmin, isApproved } = req.body
    const { db, schema } = await import('../db/index.js')
    const updates: Record<string, unknown> = {}
    if (isAdmin !== undefined) updates.isAdmin = isAdmin
    if (isApproved !== undefined) updates.isApproved = isApproved
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' })
      return
    }
    await db.update(schema.users).set(updates).where(eq(schema.users.id, param(req, 'id')))
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/setup/users — Admin creates a new user */
router.post('/users', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, displayName, password, isAdmin: makeAdmin } = req.body
    if (!email || !displayName || !password) {
      res.status(400).json({ success: false, error: 'email, displayName, and password are required' })
      return
    }
    const result = await setupService.registerLocal(email, password, displayName)
    // Optionally set admin
    if (makeAdmin) {
      const { db, schema } = await import('../db/index.js')
      await db.update(schema.users).set({ isAdmin: true }).where(eq(schema.users.id, result.user.id))
    }
    res.status(201).json({ success: true, data: { id: result.user.id, email, displayName } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/setup/users/:id/avatar — Update user avatar URL */
router.put('/users/:id/avatar', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { avatarUrl } = req.body
    const { db, schema } = await import('../db/index.js')
    await db.update(schema.users).set({ avatarUrl }).where(eq(schema.users.id, param(req, 'id')))
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
