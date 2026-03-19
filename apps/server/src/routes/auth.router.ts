import { Router } from 'express'
import { authService } from '../services/auth.service.js'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rate-limit.js'

const router = Router()

/** POST /api/auth/login - Get GitHub OAuth URL (direct, no Supabase) */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { redirectUrl } = req.body
    const url = authService.getGitHubOAuthUrl(
      redirectUrl || `${req.headers.origin}/callback`
    )
    res.json({ success: true, data: { url } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    res.status(500).json({ success: false, error: message })
  }
})

/** POST /api/auth/callback - Exchange GitHub code for session */
router.post('/callback', authLimiter, async (req, res) => {
  try {
    const { code } = req.body
    if (!code) {
      res.status(400).json({ success: false, error: 'Code is required' })
      return
    }
    const result = await authService.handleGitHubCallback(code)
    res.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Callback failed'
    res.status(500).json({ success: false, error: message })
  }
})

/** GET /api/auth/me - Get current user */
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await authService.getUserById(req.userId!)
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }
    const { githubTokenEncrypted, ...safeUser } = user
    res.json({ success: true, data: safeUser })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user'
    res.status(500).json({ success: false, error: message })
  }
})

/** POST /api/auth/dev-login - Dev mode fallback (no OAuth needed) */
router.post('/dev-login', async (_req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({ success: false, error: 'Dev login is only available in development mode' })
    return
  }
  try {
    const result = await authService.devLogin()
    res.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dev login failed'
    res.status(400).json({ success: false, error: message })
  }
})

/** POST /api/auth/logout */
router.post('/logout', authMiddleware, (_req, res) => {
  res.json({ success: true, message: 'Logged out' })
})

export default router
