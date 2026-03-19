import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { templatesService } from '../services/templates.service.js'
import { projectService } from '../services/project.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/templates - list all templates */
router.get('/', async (_req: AuthenticatedRequest, res) => {
  try {
    const templates = templatesService.listTemplates()
    res.json({ success: true, data: templates })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/templates/:id - get single template */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const template = templatesService.getTemplate(param(req, 'id'))
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }
    res.json({ success: true, data: template })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/templates/apply - apply template to existing project */
router.post('/apply', async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, templateId } = req.body as { projectId: string; templateId: string }

    if (!projectId || !templateId) {
      res.status(400).json({ success: false, error: 'projectId and templateId are required' })
      return
    }

    const project = await projectService.getById(projectId, req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    const result = await templatesService.applyTemplate(project.localPath, templateId)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
