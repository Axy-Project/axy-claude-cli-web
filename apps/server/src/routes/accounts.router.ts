import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { accountService } from '../services/account.service.js'
import type { ConnectedAccountType } from '@axy/shared'

const router = Router()
router.use(authMiddleware)

/** GET /api/accounts?type=github|claude_api_key */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const type = req.query.type as ConnectedAccountType | undefined
    const accounts = await accountService.list(req.userId!, type)
    res.json({ success: true, data: accounts })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/accounts */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { type, nickname, token, username, isDefault } = req.body
    if (!type || !nickname || !token) {
      res.status(400).json({ success: false, error: 'type, nickname, and token are required' })
      return
    }
    if (type !== 'github' && type !== 'claude_api_key') {
      res.status(400).json({ success: false, error: 'type must be "github" or "claude_api_key"' })
      return
    }
    const account = await accountService.create(req.userId!, { type, nickname, token, username, isDefault })
    res.status(201).json({ success: true, data: account })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/accounts/:id */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { nickname, token, isDefault } = req.body
    const account = await accountService.update(param(req, 'id'), req.userId!, { nickname, token, isDefault })
    if (!account) {
      res.status(404).json({ success: false, error: 'Account not found' })
      return
    }
    res.json({ success: true, data: account })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/accounts/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const deleted = await accountService.delete(param(req, 'id'), req.userId!)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Account not found' })
      return
    }
    res.json({ success: true, message: 'Account deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/accounts/:id/test - Test connectivity */
router.post('/:id/test', async (req: AuthenticatedRequest, res) => {
  try {
    const token = await accountService.getDecryptedToken(param(req, 'id'), req.userId!)
    if (!token) {
      res.status(404).json({ success: false, error: 'Account not found' })
      return
    }

    // Get account type to determine test method
    const accounts = await accountService.list(req.userId!)
    const accountId = param(req, 'id')
    const account = accounts.find((a: { id: string; type: string }) => a.id === accountId)
    if (!account) {
      res.status(404).json({ success: false, error: 'Account not found' })
      return
    }

    let result
    if (account.type === 'github') {
      result = await accountService.testGitHubToken(token)
    } else {
      result = await accountService.testClaudeApiKey(token)
    }

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
