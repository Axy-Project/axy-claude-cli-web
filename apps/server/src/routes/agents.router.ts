import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { agentService } from '../services/agent.service.js'
import { orchestratorService } from '../services/orchestrator.service.js'
import { catalogService } from '../services/catalog.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/agents/catalog - Returns the full agent catalog */
router.get('/catalog', async (_req: AuthenticatedRequest, res) => {
  try {
    const agents = await catalogService.getAgents()
    const categories = [...new Set(agents.map((a: any) => a.category))]
    res.json({
      success: true,
      data: { agents, categories },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/agents/import/:catalogId - Import a catalog agent as a user agent profile */
router.post('/import/:catalogId', async (req: AuthenticatedRequest, res) => {
  try {
    const catalogId = param(req, 'catalogId')
    const agents = await catalogService.getAgents()
    const catalogAgent = agents.find((a: any) => a.id === catalogId)

    if (!catalogAgent) {
      res.status(404).json({ success: false, error: 'Catalog agent not found' })
      return
    }

    const { orgId } = req.body || {}

    const agent = await agentService.create(req.userId!, {
      name: catalogAgent.name,
      description: catalogAgent.description,
      icon: catalogAgent.icon,
      color: catalogAgent.color,
      role: catalogAgent.role as any,
      model: catalogAgent.model,
      systemPrompt: catalogAgent.systemPrompt,
      allowedToolsJson: catalogAgent.allowedTools,
      disallowedToolsJson: catalogAgent.disallowedTools,
      extendedThinking: catalogAgent.extendedThinking,
      thinkingBudget: catalogAgent.thinkingBudget,
      orgId,
    })

    res.status(201).json({ success: true, data: agent })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/agents/built-in - Returns list of built-in agent archetypes */
router.get('/built-in', async (_req: AuthenticatedRequest, res) => {
  try {
    const agents = orchestratorService.getAllAgents()
    res.json({ success: true, data: agents })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/agents/analyze - Analyze a message and return suggested agent routing */
router.post('/analyze', async (req: AuthenticatedRequest, res) => {
  try {
    const { message, projectId, sessionId } = req.body

    if (!message) {
      res.status(400).json({ success: false, error: 'message is required' })
      return
    }

    const result = orchestratorService.analyzeAndRoute(message, {
      projectId: projectId || '',
      sessionId: sessionId || '',
    })

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/agents */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const agents = await agentService.list(req.userId!, String(req.query.orgId || ''))
    res.json({ success: true, data: agents })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/agents/hierarchy */
router.get('/hierarchy', async (req: AuthenticatedRequest, res) => {
  try {
    const hierarchy = await agentService.getHierarchy(req.userId!)
    res.json({ success: true, data: hierarchy })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/agents/:id */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const agent = await agentService.getById(param(req, 'id'))
    if (!agent) {
      res.status(404).json({ success: false, error: 'Agent not found' })
      return
    }
    res.json({ success: true, data: agent })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/agents */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const agent = await agentService.create(req.userId!, req.body)
    res.status(201).json({ success: true, data: agent })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/agents/:id */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const agent = await agentService.update(param(req, 'id'), req.userId!, req.body)
    if (!agent) {
      res.status(404).json({ success: false, error: 'Agent not found' })
      return
    }
    res.json({ success: true, data: agent })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/agents/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await agentService.delete(param(req, 'id'), req.userId!)
    res.json({ success: true, message: 'Agent deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
