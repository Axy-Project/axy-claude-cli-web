import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import path from 'path'
import fs from 'fs/promises'
import { config } from '../config.js'

const router = Router()
router.use(authMiddleware)

const PLUGINS_DIR = path.resolve(config.projectsDir, '..', 'plugins')

// Ensure plugins directory exists
fs.mkdir(PLUGINS_DIR, { recursive: true }).catch(() => {})

interface PluginManifest {
  id: string
  name: string
  description: string
  version: string
  author: string
  hooks?: {
    onMessage?: string
    onSessionStart?: string
    onSessionEnd?: string
    onProjectCreate?: string
    onDeploy?: string
  }
  settings?: Record<string, { type: string; label: string; default?: unknown }>
  enabled: boolean
  createdAt: string
}

/** GET /api/plugins — List all installed plugins */
router.get('/', async (_req: AuthenticatedRequest, res) => {
  try {
    const files = await fs.readdir(PLUGINS_DIR).catch(() => [])
    const plugins: PluginManifest[] = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const content = await fs.readFile(path.join(PLUGINS_DIR, file), 'utf-8')
        plugins.push(JSON.parse(content))
      } catch { /* skip invalid */ }
    }
    res.json({ success: true, data: plugins })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/plugins/:id — Get a single plugin */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const filePath = path.join(PLUGINS_DIR, `${req.params.id}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ success: true, data: JSON.parse(content) })
  } catch {
    res.status(404).json({ success: false, error: 'Plugin not found' })
  }
})

/** POST /api/plugins — Create a new plugin */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, version, author, hooks, settings } = req.body
    if (!name) { res.status(400).json({ success: false, error: 'name is required' }); return }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const plugin: PluginManifest = {
      id,
      name,
      description: description || '',
      version: version || '1.0.0',
      author: author || 'Unknown',
      hooks: hooks || {},
      settings: settings || {},
      enabled: true,
      createdAt: new Date().toISOString(),
    }

    await fs.writeFile(path.join(PLUGINS_DIR, `${id}.json`), JSON.stringify(plugin, null, 2))
    res.status(201).json({ success: true, data: plugin })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/plugins/:id — Update a plugin */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const filePath = path.join(PLUGINS_DIR, `${req.params.id}.json`)
    const existing = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    const updated = { ...existing, ...req.body, id: existing.id }
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2))
    res.json({ success: true, data: updated })
  } catch {
    res.status(404).json({ success: false, error: 'Plugin not found' })
  }
})

/** DELETE /api/plugins/:id — Delete a plugin */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await fs.unlink(path.join(PLUGINS_DIR, `${req.params.id}.json`))
    res.json({ success: true })
  } catch {
    res.status(404).json({ success: false, error: 'Plugin not found' })
  }
})

/** PATCH /api/plugins/:id/toggle — Enable/disable a plugin */
router.patch('/:id/toggle', async (req: AuthenticatedRequest, res) => {
  try {
    const filePath = path.join(PLUGINS_DIR, `${req.params.id}.json`)
    const plugin = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    plugin.enabled = !plugin.enabled
    await fs.writeFile(filePath, JSON.stringify(plugin, null, 2))
    res.json({ success: true, data: plugin })
  } catch {
    res.status(404).json({ success: false, error: 'Plugin not found' })
  }
})

export default router
