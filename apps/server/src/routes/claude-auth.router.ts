import { Router } from 'express'
import { spawn } from 'child_process'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { accountService } from '../services/account.service.js'
import { config } from '../config.js'

const router = Router()
router.use(authMiddleware)

// Track active login processes
const activeLogins = new Map<string, { process: any; url: string | null; status: string }>()

/** GET /api/claude/status - Check Claude CLI auth status */
router.get('/status', async (req: AuthenticatedRequest, res) => {
  try {
    const accounts = await accountService.list(req.userId!, 'claude_api_key')
    const hasApiKey = accounts.length > 0
    const hasEnvKey = !!process.env.ANTHROPIC_API_KEY

    let cliStatus: any = null
    try {
      const { execSync } = await import('child_process')
      const result = execSync(`${config.claudePath} auth status`, {
        timeout: 5000,
        encoding: 'utf-8',
        env: { ...process.env, NO_COLOR: '1' },
      })
      cliStatus = JSON.parse(result)
    } catch { /* CLI not available or not logged in */ }

    res.json({
      success: true,
      data: {
        hasApiKey,
        hasEnvKey,
        cliLoggedIn: cliStatus?.loggedIn ?? false,
        cliEmail: cliStatus?.email ?? null,
        cliAuthMethod: cliStatus?.authMethod ?? null,
        cliSubscription: cliStatus?.subscriptionType ?? null,
        cliInstalled: cliStatus !== null || hasEnvKey,
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

/** POST /api/claude/login - Start CLI login flow, returns OAuth URL */
router.post('/login', async (req: AuthenticatedRequest, res) => {
  try {
    const { method } = req.body || {} // 'claudeai' or 'console'
    const userId = req.userId!

    // Kill existing login process for this user
    const existing = activeLogins.get(userId)
    if (existing?.process) {
      try { existing.process.kill() } catch { /* ignore */ }
    }

    const args = ['auth', 'login']
    if (method === 'console') args.push('--console')

    const loginProcess = spawn(config.claudePath, args, {
      env: { ...process.env, NO_COLOR: '1', BROWSER: 'echo' }, // Prevent browser open, output URL
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const entry = { process: loginProcess, url: null as string | null, status: 'waiting' }
    activeLogins.set(userId, entry)

    let output = ''

    const handleOutput = (data: Buffer) => {
      const text = data.toString()
      output += text

      // Extract OAuth URL from output
      const urlMatch = output.match(/(https:\/\/(?:platform\.claude\.com|console\.anthropic\.com)[^\s]+)/)
      if (urlMatch && !entry.url) {
        entry.url = urlMatch[1]
        entry.status = 'awaiting_auth'
      }
    }

    loginProcess.stdout?.on('data', handleOutput)
    loginProcess.stderr?.on('data', handleOutput)

    loginProcess.on('close', (code) => {
      const e = activeLogins.get(userId)
      if (e) {
        e.status = code === 0 ? 'success' : 'failed'
        // Clean up after 60 seconds
        setTimeout(() => activeLogins.delete(userId), 60000)
      }
    })

    // Wait up to 5 seconds for the URL to appear
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (entry.url || entry.status !== 'waiting') {
          clearInterval(check)
          resolve()
        }
      }, 200)
      setTimeout(() => { clearInterval(check); resolve() }, 5000)
    })

    if (entry.url) {
      res.json({ success: true, data: { url: entry.url, status: 'awaiting_auth' } })
    } else {
      res.json({ success: true, data: { url: null, status: entry.status, output } })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/claude/login/status - Check login progress */
router.get('/login/status', async (req: AuthenticatedRequest, res) => {
  try {
    const entry = activeLogins.get(req.userId!)
    if (!entry) {
      // No active login — check current CLI status
      try {
        const { execSync } = await import('child_process')
        const result = execSync(`${config.claudePath} auth status`, {
          timeout: 5000,
          encoding: 'utf-8',
          env: { ...process.env, NO_COLOR: '1' },
        })
        const status = JSON.parse(result)
        if (status.loggedIn) {
          res.json({ success: true, data: { status: 'success', email: status.email } })
          return
        }
      } catch { /* ignore */ }
      res.json({ success: true, data: { status: 'none' } })
      return
    }

    res.json({ success: true, data: { status: entry.status, url: entry.url } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/claude/logout - Logout from CLI */
router.post('/logout', async (_req: AuthenticatedRequest, res) => {
  try {
    const { execSync } = await import('child_process')
    execSync(`${config.claudePath} auth logout`, {
      timeout: 5000,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1' },
    })
    res.json({ success: true, message: 'Logged out from Claude CLI' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/claude/test-key - Test if an API key is valid */
router.post('/test-key', async (_req: AuthenticatedRequest, res) => {
  try {
    const { apiKey } = _req.body
    if (!apiKey) {
      res.status(400).json({ success: false, error: 'apiKey is required' })
      return
    }

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
          ? 'api_key'
          : process.env.ANTHROPIC_API_KEY
            ? 'server_env'
            : 'cli_auth',
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
