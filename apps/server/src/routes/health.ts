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

    // Find compose project dir and update
    setTimeout(() => {
      // Find the compose working directory from container labels
      const findDirCmd = `docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' $(hostname) 2>/dev/null`
      exec(findDirCmd, { timeout: 10000 }, (err, workDir) => {
        const dir = workDir?.trim()
        if (!dir) {
          console.error('[Update] Cannot find compose working directory')
          return
        }

        console.log('[Update] Compose dir:', dir)

        // Check if using pre-built images or build-from-source
        const checkCmd = `grep -l "^    image:" "${dir}/docker-compose.yml" "${dir}/docker-compose.prod.yml" 2>/dev/null | head -1`
        exec(checkCmd, { timeout: 5000 }, (checkErr, composePath) => {
          const file = composePath?.trim()

          if (file) {
            // Pre-built images: pull + recreate
            console.log('[Update] Using pre-built images:', file)
            const updateCmd = `cd "${dir}" && docker compose -f "${file}" pull && docker compose -f "${file}" up -d`
            exec(updateCmd, { timeout: 300000 }, (upErr, upOut) => {
              if (upErr) console.error('[Update] Failed:', upErr.message)
              else console.log('[Update] Success:', upOut)
            })
          } else {
            // Build from source: git pull + build + recreate
            console.log('[Update] Build from source mode')
            const updateCmd = `cd "${dir}" && git pull origin main 2>&1 && docker compose build --no-cache 2>&1 && docker compose up -d 2>&1`
            exec(updateCmd, { timeout: 600000 }, (upErr, upOut) => {
              if (upErr) console.error('[Update] Failed:', upErr.message)
              else console.log('[Update] Success:', upOut)
            })
          }
        })
      })
    }, 1000)
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
