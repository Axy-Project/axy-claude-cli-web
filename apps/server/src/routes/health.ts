import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()

// Read version from VERSION file (once at startup)
let appVersion = '1.0.0'
try {
  const versionPath = path.resolve(process.cwd(), '../../VERSION')
  appVersion = fs.readFileSync(versionPath, 'utf-8').trim()
} catch {
  try {
    const versionPath = path.resolve(process.cwd(), 'VERSION')
    appVersion = fs.readFileSync(versionPath, 'utf-8').trim()
  } catch { /* use default */ }
}

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: appVersion,
    uptime: Math.floor(process.uptime()),
  })
})

/** GET /api/health/version - Check for updates */
router.get('/version', async (_req, res) => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/Axy-Project/axy-claude-cli-web/main/VERSION')
    if (response.ok) {
      const latestVersion = (await response.text()).trim()
      res.json({
        current: appVersion,
        latest: latestVersion,
        updateAvailable: latestVersion !== appVersion,
      })
    } else {
      res.json({ current: appVersion, latest: null, updateAvailable: false })
    }
  } catch {
    res.json({ current: appVersion, latest: null, updateAvailable: false })
  }
})

/** POST /api/health/update - Self-update: pull latest images and restart */
router.post('/update', async (_req, res) => {
  try {
    const { exec } = await import('child_process')

    // Check if Docker socket is available
    const { existsSync } = await import('fs')
    if (!existsSync('/var/run/docker.sock')) {
      res.status(400).json({
        success: false,
        error: 'Docker socket not mounted. Add docker.sock volume to enable self-update.',
      })
      return
    }

    // Respond immediately — the server will restart
    res.json({ success: true, message: 'Update started. Server will restart shortly.' })

    // Pull new images and recreate containers via Docker API
    setTimeout(() => {
      // Get own container ID to find the compose project
      const containerId = require('fs').readFileSync('/proc/1/cpuset', 'utf-8').trim().split('/').pop() || ''

      // Pull latest images for all services with the same compose project
      const pullCmd = `docker pull ghcr.io/axy-project/axyweb-server:latest && docker pull ghcr.io/axy-project/axyweb-web:latest`

      exec(pullCmd, { timeout: 120000 }, (pullErr, pullOut) => {
        if (pullErr) {
          console.error('[Update] Pull failed:', pullErr.message)
          return
        }
        console.log('[Update] Images pulled:', pullOut)

        // Find and restart compose project
        // Use docker inspect to find the compose project label
        const restartCmd = `docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' $(hostname) 2>/dev/null`
        exec(restartCmd, { timeout: 10000 }, (inspErr, workDir) => {
          const dir = workDir?.trim()
          if (dir) {
            exec(`cd "${dir}" && docker compose up -d`, { timeout: 120000 }, (upErr, upOut) => {
              if (upErr) console.error('[Update] Restart failed:', upErr.message)
              else console.log('[Update] Restarted:', upOut)
            })
          } else {
            // Fallback: just restart own container
            exec(`docker restart $(hostname)`, { timeout: 30000 }, () => {})
          }
        })
      })
    }, 1000)
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
