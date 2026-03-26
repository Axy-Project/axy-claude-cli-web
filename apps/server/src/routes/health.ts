import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { config } from '../config.js'

// Persistent update status file (survives container restart)
const UPDATE_STATUS_FILE = path.join(config.projectsDir, '.update-status.json')

interface UpdateStatus {
  status: 'idle' | 'pulling' | 'building' | 'restarting' | 'done' | 'error'
  message: string
  startedAt?: string
  completedAt?: string
}

function writeUpdateStatus(status: UpdateStatus) {
  try { fs.writeFileSync(UPDATE_STATUS_FILE, JSON.stringify(status)) } catch { /* ignore */ }
}

function readUpdateStatus(): UpdateStatus {
  try {
    const data = JSON.parse(fs.readFileSync(UPDATE_STATUS_FILE, 'utf-8'))
    // Auto-clear old statuses (>5 min old)
    if (data.startedAt && Date.now() - new Date(data.startedAt).getTime() > 5 * 60 * 1000) {
      return { status: 'idle', message: '' }
    }
    return data
  } catch { return { status: 'idle', message: '' } }
}

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

/** GET /api/health/update-status — Check update progress (persists across restarts) */
router.get('/update-status', (_req, res) => {
  const status = readUpdateStatus()
  res.json({ success: true, data: status })
})

// Clear update status on startup (if server restarted after update, it succeeded)
{
  const status = readUpdateStatus()
  if (status.status === 'restarting' || status.status === 'pulling' || status.status === 'building') {
    writeUpdateStatus({ status: 'done', message: 'Update completed — server restarted successfully', completedAt: new Date().toISOString() })
  }
}

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

    writeUpdateStatus({ status: 'pulling', message: 'Update started — pulling changes...', startedAt: new Date().toISOString() })
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
          const compose = `docker compose -p "${projectName}" -f "${composeFile}" --env-file "${envFile}" --project-directory "${hostWorkDir}"`

          // Detect build-from-source: check if .git exists in host work dir (mounted at /opt/axy-src)
          const isBuildFromSource = fs.existsSync('/opt/axy-src/.git')
          console.log(`[Update] Mode: ${isBuildFromSource ? 'build-from-source' : 'pre-built images'}`)

          let sidecarScript: string
          if (isBuildFromSource) {
            // Build-from-source: git pull + rebuild images
            sidecarScript = [
              `git -C "${hostWorkDir}" pull origin main 2>&1`,
              `${compose} build --no-cache 2>&1`,
              `${compose} up -d 2>&1`,
            ].join(' && ')
          } else {
            // Pre-built images: pull + restart
            sidecarScript = [
              `${compose} pull 2>&1`,
              `${compose} up -d 2>&1`,
            ].join(' && ')
          }

          // Use alpine/git image (has both git and docker via socket) for build-from-source
          // docker:cli for pre-built (lighter)
          const sidecarImage = isBuildFromSource ? 'alpine:latest' : 'docker:cli'
          const installDeps = isBuildFromSource
            ? 'apk add --no-cache git docker-cli docker-cli-compose && '
            : ''

          const updateCmd = `docker run --rm -d ` +
            `-v /var/run/docker.sock:/var/run/docker.sock ` +
            `-v "${hostWorkDir}:${hostWorkDir}" ` +
            `${sidecarImage} sh -c '${installDeps}${sidecarScript}'`

          writeUpdateStatus({ status: 'restarting', message: `${isBuildFromSource ? 'Building from source' : 'Pulling images'}...`, startedAt: new Date().toISOString() })
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

/** GET /api/health/versions - List available versions from GitHub tags */
router.get('/versions', async (_req, res) => {
  try {
    const response = await fetch('https://api.github.com/repos/Axy-Project/axy-claude-cli-web/tags?per_page=20', {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Axy-Server' },
    })
    if (!response.ok) {
      res.json({ success: true, data: { current: appVersion, versions: [] } })
      return
    }
    const tags = (await response.json()) as { name: string }[]
    const versions = tags
      .map((t) => t.name.replace(/^v/, ''))
      .filter((v) => /^\d+\.\d+\.\d+/.test(v))
    res.json({ success: true, data: { current: appVersion, versions } })
  } catch {
    res.json({ success: true, data: { current: appVersion, versions: [] } })
  }
})

/** POST /api/health/rollback - Rollback to a specific version via Docker */
router.post('/rollback', async (req, res) => {
  try {
    const { version: targetVersion } = req.body as { version?: string }
    if (!targetVersion || !/^\d+\.\d+\.\d+/.test(targetVersion)) {
      res.status(400).json({ success: false, error: 'Valid version required (e.g. 1.5.9)' })
      return
    }

    const { exec } = await import('child_process')
    const { existsSync, readFileSync } = await import('fs')

    if (!existsSync('/var/run/docker.sock')) {
      res.status(400).json({ success: false, error: 'Docker socket not available. Mount /var/run/docker.sock to enable rollback.' })
      return
    }

    let containerId = ''
    try { containerId = readFileSync('/etc/hostname', 'utf-8').trim() } catch { /* ignore */ }

    writeUpdateStatus({ status: 'pulling', message: `Rolling back to v${targetVersion}...`, startedAt: new Date().toISOString() })
    res.json({ success: true, message: `Rollback to v${targetVersion} started. Server will restart shortly.` })

    setTimeout(() => {
      const inspectCmd = `docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.working_dir"}}' ${containerId} 2>/dev/null`

      exec(inspectCmd, { timeout: 10000 }, (_err, labels) => {
        const [projectName, hostWorkDir] = (labels?.trim() || '').split('|')

        if (projectName && hostWorkDir) {
          const composeFile = `${hostWorkDir}/docker-compose.yml`
          const envFile = `${hostWorkDir}/.env`
          const compose = `docker compose -p "${projectName}" -f "${composeFile}" --env-file "${envFile}" --project-directory "${hostWorkDir}"`
          const isBuildFromSource = fs.existsSync('/opt/axy-src/.git')

          let sidecarScript: string
          if (isBuildFromSource) {
            sidecarScript = [
              `git -C "${hostWorkDir}" fetch --tags 2>&1`,
              `git -C "${hostWorkDir}" checkout "v${targetVersion}" 2>&1`,
              `${compose} build --no-cache 2>&1`,
              `${compose} up -d 2>&1`,
            ].join(' && ')
          } else {
            // For pre-built images, tag-based rollback isn't straightforward
            // Fall back to git checkout approach
            sidecarScript = [
              `git -C "${hostWorkDir}" fetch --tags 2>&1`,
              `git -C "${hostWorkDir}" checkout "v${targetVersion}" 2>&1`,
              `${compose} build --no-cache 2>&1`,
              `${compose} up -d 2>&1`,
            ].join(' && ')
          }

          const sidecarImage = 'alpine:latest'
          const installDeps = 'apk add --no-cache git docker-cli docker-cli-compose && '

          const rollbackCmd = `docker run --rm -d ` +
            `-v /var/run/docker.sock:/var/run/docker.sock ` +
            `-v "${hostWorkDir}:${hostWorkDir}" ` +
            `${sidecarImage} sh -c '${installDeps}${sidecarScript}'`

          writeUpdateStatus({ status: 'restarting', message: `Rolling back to v${targetVersion}...`, startedAt: new Date().toISOString() })
          console.log(`[Rollback] Launching sidecar for v${targetVersion}`)
          exec(rollbackCmd, { timeout: 30000 }, (err, out, stderr) => {
            if (err) console.error('[Rollback] Sidecar launch failed:', err.message, stderr)
            else console.log('[Rollback] Sidecar launched:', out.trim())
          })
        } else {
          writeUpdateStatus({ status: 'error', message: 'Cannot determine Docker Compose configuration for rollback.' })
        }
      })
    }, 1000)
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
