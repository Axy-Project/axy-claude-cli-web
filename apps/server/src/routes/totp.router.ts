import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { encryptToken, decryptToken } from '../services/auth.service.js'

const router = Router()
router.use(authMiddleware)

/** POST /api/auth/totp/setup — Generate TOTP secret + QR URI */
router.post('/setup', async (req: AuthenticatedRequest, res) => {
  try {
    const { TOTP, Secret } = await import('otpauth')
    const { db, schema } = await import('../db/index.js')

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).limit(1)
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return }

    const secret = new Secret({ size: 20 })
    const totp = new TOTP({
      issuer: 'Axy',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })

    // Store encrypted secret (not enabled yet — needs verification)
    await db.update(schema.users)
      .set({ totpSecretEncrypted: encryptToken(secret.base32) })
      .where(eq(schema.users.id, req.userId!))

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        uri: totp.toString(),
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/auth/totp/verify — Verify code and enable 2FA */
router.post('/verify', async (req: AuthenticatedRequest, res) => {
  try {
    const { code } = req.body
    if (!code) { res.status(400).json({ success: false, error: 'Code is required' }); return }

    const { TOTP, Secret } = await import('otpauth')
    const { db, schema } = await import('../db/index.js')

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).limit(1)
    if (!user || !user.totpSecretEncrypted) {
      res.status(400).json({ success: false, error: 'TOTP not set up. Call /setup first.' })
      return
    }

    const secretBase32 = decryptToken(user.totpSecretEncrypted)
    const totp = new TOTP({
      issuer: 'Axy',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secretBase32),
    })

    const delta = totp.validate({ token: code, window: 1 })
    if (delta === null) {
      res.status(403).json({ success: false, error: 'Invalid code' })
      return
    }

    // Enable 2FA
    await db.update(schema.users)
      .set({ totpEnabled: true })
      .where(eq(schema.users.id, req.userId!))

    res.json({ success: true, message: '2FA enabled' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/auth/totp/disable — Disable 2FA (requires password) */
router.post('/disable', async (req: AuthenticatedRequest, res) => {
  try {
    const { password } = req.body
    if (!password) { res.status(400).json({ success: false, error: 'Password required' }); return }

    const { setupService } = await import('../services/setup.service.js')
    const valid = await setupService.verifyPassword(req.userId!, password)
    if (!valid) { res.status(403).json({ success: false, error: 'Incorrect password' }); return }

    const { db, schema } = await import('../db/index.js')
    await db.update(schema.users)
      .set({ totpEnabled: false, totpSecretEncrypted: null })
      .where(eq(schema.users.id, req.userId!))

    res.json({ success: true, message: '2FA disabled' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/auth/totp/status — Check if 2FA is enabled */
router.get('/status', async (req: AuthenticatedRequest, res) => {
  try {
    const { db, schema } = await import('../db/index.js')
    const [user] = await db.select({ totpEnabled: schema.users.totpEnabled })
      .from(schema.users).where(eq(schema.users.id, req.userId!)).limit(1)
    res.json({ success: true, data: { enabled: user?.totpEnabled ?? false } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
