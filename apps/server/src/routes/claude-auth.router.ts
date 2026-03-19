import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { accountService } from '../services/account.service.js'
import { config } from '../config.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/claude/status - Check Claude CLI auth status */
router.get('/status', async (req: AuthenticatedRequest, res) => {
  try {
    // Check if user has any Claude API key configured
    const accounts = await accountService.list(req.userId!, 'claude_api_key')
    const hasApiKey = accounts.length > 0
    const hasEnvKey = !!process.env.ANTHROPIC_API_KEY

    // Check CLI auth status
    let cliStatus: any = null
    try {
      const { execSync } = await import('child_process')
      const result = execSync(`${config.claudePath} auth status`, {
        timeout: 5000,
        encoding: 'utf-8',
        env: { ...process.env, NO_COLOR: '1' },
      })
      cliStatus = JSON.parse(result)
    } catch {
      // CLI not logged in or not available
    }

    res.json({
      success: true,
      data: {
        hasApiKey,
        hasEnvKey,
        cliLoggedIn: cliStatus?.loggedIn ?? false,
        cliEmail: cliStatus?.email ?? null,
        cliAuthMethod: cliStatus?.authMethod ?? null,
        accounts: accounts.map((a: any) => ({
          id: a.id,
          nickname: a.nickname,
          isDefault: a.isDefault,
        })),
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/claude/test-key - Test if an API key is valid */
router.post('/test-key', async (req: AuthenticatedRequest, res) => {
  try {
    const { apiKey } = req.body
    if (!apiKey) {
      res.status(400).json({ success: false, error: 'apiKey is required' })
      return
    }

    // Test key by calling Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })

    if (response.ok) {
      res.json({ success: true, data: { valid: true } })
    } else {
      const err = await response.json().catch(() => ({}))
      res.json({ success: true, data: { valid: false, error: (err as any).error?.message || `HTTP ${response.status}` } })
    }
  } catch (error) {
    res.json({ success: true, data: { valid: false, error: (error as Error).message } })
  }
})

/** GET /api/claude/project/:projectId/status - Check which key a project uses */
router.get('/project/:projectId/status', async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = req.params.projectId as string
    const resolvedKey = await accountService.resolveClaudeApiKey(req.userId!, projectId)

    res.json({
      success: true,
      data: {
        hasKey: !!resolvedKey,
        source: resolvedKey
          ? 'configured'
          : process.env.ANTHROPIC_API_KEY
            ? 'server_env'
            : 'none',
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
