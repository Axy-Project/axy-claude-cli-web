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

    // Respond immediately — the server will restart
    res.json({ success: true, message: 'Update started. Server will restart in ~30 seconds.' })

    // Run update in background after response is sent
    setTimeout(() => {
      const cwd = process.cwd()
      // Try docker compose first (pre-built images), fallback to git pull + build
      const updateCmd = `
        cd "${cwd}/../.." 2>/dev/null || cd "${cwd}" ;
        if [ -f docker-compose.yml ]; then
          docker compose pull 2>/dev/null && docker compose up -d 2>/dev/null
        elif [ -f docker-compose.prod.yml ]; then
          docker compose -f docker-compose.prod.yml pull 2>/dev/null && docker compose -f docker-compose.prod.yml up -d 2>/dev/null
        else
          git pull origin main 2>/dev/null && docker compose build --no-cache 2>/dev/null && docker compose up -d 2>/dev/null
        fi
      `
      exec(updateCmd, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Update] Failed:', error.message)
        } else {
          console.log('[Update] Success:', stdout)
        }
      })
    }, 1000)
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
