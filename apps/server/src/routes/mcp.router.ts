import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { mcpService } from '../services/mcp.service.js'

const router = Router()
router.use(authMiddleware)

// ─── Registry ────────────────────────────────────────────

const REGISTRY_BASE = 'https://api.anthropic.com/mcp-registry/v0/servers'

/** GET /api/mcp/registry/browse?search=&cursor= - Browse Anthropic MCP registry */
router.get('/registry/browse', async (req: AuthenticatedRequest, res) => {
  try {
    const { search, cursor } = req.query as { search?: string; cursor?: string }
    const params = new URLSearchParams({ version: 'latest', limit: '50' })
    if (search) params.set('search', search)
    if (cursor) params.set('cursor', cursor)

    const response = await fetch(`${REGISTRY_BASE}?${params}`)
    if (!response.ok) throw new Error(`Registry fetch failed: ${response.status}`)
    const data = await response.json()
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/mcp/registry/import - Import an MCP server from registry into a project */
router.post('/registry/import', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      projectId,
      serverName,
      displayName,
      command,
      argsJson,
      envJson,
      remoteUrl,
      transportType,
    } = req.body as {
      projectId: string
      serverName: string
      displayName: string
      command?: string
      argsJson?: string[]
      envJson?: Record<string, string>
      remoteUrl?: string
      transportType?: string
    }

    if (!projectId || !serverName) {
      res.status(400).json({ success: false, error: 'projectId and serverName are required' })
      return
    }

    // Determine server type and build command/args
    let serverType = 'stdio'
    let serverCommand = command || 'npx'
    let serverArgs = argsJson || []

    if (remoteUrl) {
      // Remote/HTTP server
      serverType = transportType === 'sse' ? 'sse' : 'streamable-http'
      serverCommand = remoteUrl
      serverArgs = []
    }

    const server = await mcpService.create({
      projectId,
      name: displayName || serverName,
      type: serverType,
      command: serverCommand,
      argsJson: serverArgs,
      envJson: envJson || {},
    })

    res.status(201).json({ success: true, data: server })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ─── Project Servers ─────────────────────────────────────

/** GET /api/mcp/project/:projectId */
router.get('/project/:projectId', async (req: AuthenticatedRequest, res) => {
  try {
    const servers = await mcpService.listByProject(param(req, 'projectId'))
    res.json({ success: true, data: servers })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/mcp/project/:projectId/config */
router.get('/project/:projectId/config', async (req: AuthenticatedRequest, res) => {
  try {
    const config = await mcpService.getConfigForProject(param(req, 'projectId'))
    res.json({ success: true, data: config })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/mcp/:id */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const server = await mcpService.getById(param(req, 'id'))
    if (!server) {
      res.status(404).json({ success: false, error: 'MCP server not found' })
      return
    }
    res.json({ success: true, data: server })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/mcp */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const server = await mcpService.create(req.body)
    res.status(201).json({ success: true, data: server })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/mcp/:id */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const server = await mcpService.update(param(req, 'id'), req.body)
    if (!server) {
      res.status(404).json({ success: false, error: 'MCP server not found' })
      return
    }
    res.json({ success: true, data: server })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/mcp/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await mcpService.delete(param(req, 'id'))
    res.json({ success: true, message: 'MCP server deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
