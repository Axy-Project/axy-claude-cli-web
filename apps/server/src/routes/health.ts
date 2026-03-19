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
    const response = await fetch('https://raw.githubusercontent.com/Axy-Project/AxyWeb/main/VERSION')
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

export default router
