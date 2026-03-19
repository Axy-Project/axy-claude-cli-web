import { Router } from 'express'
import { setupService } from '../services/setup.service.js'

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

    const result = await setupService.loginLocal(email, password)
    if (!result) {
      res.status(401).json({ success: false, error: 'Invalid email or password' })
      return
    }

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
