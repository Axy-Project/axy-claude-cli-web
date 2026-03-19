import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { skillService } from '../services/skill.service.js'
import { skillCatalog } from '../data/skill-catalog.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/skills/catalog */
router.get('/catalog', async (_req, res) => {
  try {
    res.json({ success: true, data: skillCatalog })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/skills/catalog/:id */
router.get('/catalog/:id', async (req, res) => {
  try {
    const id = param(req, 'id')
    const skill = skillCatalog.find((s) => s.id === id)
    if (!skill) {
      res.status(404).json({ success: false, error: 'Catalog skill not found' })
      return
    }
    res.json({ success: true, data: skill })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/skills/import/:catalogId */
router.post('/import/:catalogId', async (req: AuthenticatedRequest, res) => {
  try {
    const catalogId = param(req, 'catalogId')
    const catalogSkill = skillCatalog.find((s) => s.id === catalogId)
    if (!catalogSkill) {
      res.status(404).json({ success: false, error: 'Catalog skill not found' })
      return
    }

    const skill = await skillService.create(req.userId!, {
      name: catalogSkill.name,
      description: catalogSkill.description,
      trigger: catalogSkill.trigger,
      promptTemplate: catalogSkill.promptTemplate,
      category: catalogSkill.category,
      isGlobal: false,
      orgId: req.body.orgId || undefined,
    })

    res.status(201).json({ success: true, data: skill })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/skills */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const skills = await skillService.list(req.userId!, String(req.query.orgId || ''))
    res.json({ success: true, data: skills })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/skills/:id */
router.get('/:id', async (req, res) => {
  try {
    const skill = await skillService.getById(param(req, 'id'))
    if (!skill) {
      res.status(404).json({ success: false, error: 'Skill not found' })
      return
    }
    res.json({ success: true, data: skill })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/skills */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const skill = await skillService.create(req.userId!, req.body)
    res.status(201).json({ success: true, data: skill })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/skills/:id */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const skill = await skillService.update(param(req, 'id'), req.userId!, req.body)
    if (!skill) {
      res.status(404).json({ success: false, error: 'Skill not found' })
      return
    }
    res.json({ success: true, data: skill })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/skills/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await skillService.delete(param(req, 'id'), req.userId!)
    res.json({ success: true, message: 'Skill deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
