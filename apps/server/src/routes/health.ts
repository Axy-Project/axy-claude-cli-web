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

/** POST /api/health/update - Self-update via Docker */
router.post('/update', async (_req, res) => {
  try {
    const { exec } = await import('child_process')
    const { existsSync, readFileSync } = await import('fs')

    if (!existsSync('/var/run/docker.sock')) {
      res.status(400).json({ success: false, error: 'Docker socket not available. Mount /var/run/docker.sock to enable self-update.' })
      return
    }

    // Get container ID and compose project info
    let containerId = ''
    try { containerId = readFileSync('/etc/hostname', 'utf-8').trim() } catch { /* ignore */ }

    res.json({ success: true, message: 'Update started. Server will restart shortly.' })

    setTimeout(() => {
      // Get compose project info from container labels
      const inspectCmd = `docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.working_dir"}}' ${containerId} 2>/dev/null`

      exec(inspectCmd, { timeout: 10000 }, (_err, labels) => {
        const [projectName, workDir] = (labels?.trim() || '').split('|')

        if (projectName && workDir) {
          console.log(`[Update] Project: ${projectName}, Dir: ${workDir}`)

          // Use -f and --project-directory flags so docker CLI talks to the host daemon
          // which has access to host paths (the container itself doesn't have workDir)
          const compose = `docker compose -f "${workDir}/docker-compose.yml" --project-directory "${workDir}"`

          // Try pre-built first (pull), fallback to build from source (git pull + build)
          const updateCmd = `(${compose} pull 2>&1 && ${compose} up -d 2>&1) || (cd "${workDir}" && git pull origin main 2>&1 && ${compose} up -d --build 2>&1)`

          exec(updateCmd, { timeout: 600000 }, (upErr, upOut, upStderr) => {
            if (upErr) console.error('[Update] Failed:', upErr.message, upStderr)
            else console.log('[Update] Success:', upOut)
          })
        } else {
          // Fallback: try pulling images directly
          console.log('[Update] No compose labels found, trying direct pull')
          const pullCmd = 'docker pull ghcr.io/axy-project/axyweb-server:latest && docker pull ghcr.io/axy-project/axyweb-web:latest'
          exec(pullCmd, { timeout: 120000 }, (pullErr, pullOut) => {
            if (pullErr) console.error('[Update] Pull failed:', pullErr.message)
            else {
              console.log('[Update] Images pulled:', pullOut)
              exec(`docker restart ${containerId}`, { timeout: 30000 }, () => {})
            }
          })
        }
      })
    }, 1000)
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
