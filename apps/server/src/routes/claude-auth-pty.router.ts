import { Router } from 'express'
import { spawn } from 'node-pty'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { config } from '../config.js'

const router = Router()
router.use(authMiddleware)

// Store active PTY sessions
const activePtys = new Map<string, { pty: any; output: string; status: 'running' | 'done' | 'error' }>()

/** POST /api/claude/login-pty — Start claude auth login with real PTY */
router.post('/start', async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!

  // Kill existing
  const existing = activePtys.get(userId)
  if (existing?.pty) {
    try { existing.pty.kill() } catch { /* ignore */ }
  }

  try {
    const ptyProcess = spawn(config.claudePath, ['auth', 'login'], {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: '/tmp',
      env: { ...process.env, NO_COLOR: '1', TERM: 'xterm-256color' } as Record<string, string>,
    })

    const entry = { pty: ptyProcess, output: '', status: 'running' as const }
    activePtys.set(userId, entry)

    ptyProcess.onData((data: string) => {
      entry.output += data
    })

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      const e = activePtys.get(userId)
      if (e) {
        e.status = exitCode === 0 ? 'done' : 'error'
      }
      // Clean up after 2 minutes
      setTimeout(() => activePtys.delete(userId), 120000)
    })

    res.json({ success: true, data: { started: true } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/claude/login-pty/output — Get current PTY output */
router.get('/output', async (req: AuthenticatedRequest, res) => {
  const entry = activePtys.get(req.userId!)
  if (!entry) {
    res.json({ success: true, data: { output: '', status: 'none' } })
    return
  }
  res.json({ success: true, data: { output: entry.output, status: entry.status } })
})

/** POST /api/claude/login-pty/input — Send input to PTY */
router.post('/input', async (req: AuthenticatedRequest, res) => {
  const entry = activePtys.get(req.userId!)
  if (!entry?.pty || entry.status !== 'running') {
    res.status(400).json({ success: false, error: 'No active login session' })
    return
  }
  const { data } = req.body
  if (data) {
    entry.pty.write(data)
  }
  res.json({ success: true })
})

/** POST /api/claude/login-pty/kill — Kill PTY */
router.post('/kill', async (req: AuthenticatedRequest, res) => {
  const entry = activePtys.get(req.userId!)
  if (entry?.pty) {
    try { entry.pty.kill() } catch { /* ignore */ }
    activePtys.delete(req.userId!)
  }
  res.json({ success: true })
})

export default router
