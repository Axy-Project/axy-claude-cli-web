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
        const [projectName, hostWorkDir] = (labels?.trim() || '').split('|')

        // The compose file is mounted at /opt/axy-src inside the container (read-only)
        // but docker compose -f needs the HOST path (daemon resolves it on the host)
        const localComposeFile = '/opt/axy-src/docker-compose.yml'

        if (projectName && hostWorkDir) {
          console.log(`[Update] Project: ${projectName}, Host dir: ${hostWorkDir}`)

          // Use a sidecar container to run the update — the server container will be
          // killed during "up -d" so it can't supervise its own recreation.
          // The sidecar runs detached (-d) and survives the server's death.
          const composeFile = `${hostWorkDir}/docker-compose.yml`
          const envFile = `${hostWorkDir}/.env`

          // Try pull first, then up -d via sidecar
          const sidecarScript = [
            `docker compose -p "${projectName}" -f "${composeFile}" --env-file "${envFile}" --project-directory "${hostWorkDir}" pull 2>&1`,
            `docker compose -p "${projectName}" -f "${composeFile}" --env-file "${envFile}" --project-directory "${hostWorkDir}" up -d 2>&1`,
          ].join(' && ')

          // Launch a lightweight Alpine container with docker CLI to run the update
          const updateCmd = `docker run --rm -d ` +
            `-v /var/run/docker.sock:/var/run/docker.sock ` +
            `-v "${hostWorkDir}:${hostWorkDir}:ro" ` +
            `docker:cli sh -c '${sidecarScript}'`

          console.log('[Update] Launching sidecar update container')
          exec(updateCmd, { timeout: 30000 }, (upErr, upOut, upStderr) => {
            if (upErr) console.error('[Update] Sidecar launch failed:', upErr.message, upStderr)
            else console.log('[Update] Sidecar launched:', upOut.trim())
          })
        } else {
          // Fallback: pull images via sidecar then restart
          console.log('[Update] No compose labels found, trying direct pull via sidecar')
          const pullScript = 'docker pull ghcr.io/axy-project/axyweb-server:latest && docker pull ghcr.io/axy-project/axyweb-web:latest'
          const pullCmd = `docker run --rm -d -v /var/run/docker.sock:/var/run/docker.sock docker:cli sh -c '${pullScript} && docker restart ${containerId}'`
          exec(pullCmd, { timeout: 30000 }, (pullErr, pullOut) => {
            if (pullErr) console.error('[Update] Sidecar pull failed:', pullErr.message)
            else console.log('[Update] Sidecar pull launched:', pullOut.trim())
          })
        }
      })
    }, 1000)
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
