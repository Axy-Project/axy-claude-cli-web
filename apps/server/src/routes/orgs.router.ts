import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { orgService } from '../services/org.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/orgs */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const orgs = await orgService.list(req.userId!)
    res.json({ success: true, data: orgs })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/orgs/:id */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const org = await orgService.getById(param(req, 'id'))
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' })
      return
    }
    res.json({ success: true, data: org })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/orgs */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, slug } = req.body
    if (!name || !slug) {
      res.status(400).json({ success: false, error: 'name and slug are required' })
      return
    }
    const org = await orgService.create(req.userId!, name, slug)
    res.status(201).json({ success: true, data: org })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/orgs/:id */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const role = await orgService.checkMembership(param(req, 'id'), req.userId!)
    if (!role || !['owner', 'admin'].includes(role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' })
      return
    }
    const org = await orgService.update(param(req, 'id'), req.body)
    res.json({ success: true, data: org })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/orgs/:id/members */
router.get('/:id/members', async (req: AuthenticatedRequest, res) => {
  try {
    const members = await orgService.listMembers(param(req, 'id'))
    res.json({ success: true, data: members })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/orgs/:id/members */
router.post('/:id/members', async (req: AuthenticatedRequest, res) => {
  try {
    const role = await orgService.checkMembership(param(req, 'id'), req.userId!)
    if (!role || !['owner', 'admin'].includes(role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' })
      return
    }
    const { userId, role: memberRole } = req.body
    const member = await orgService.addMember(param(req, 'id'), userId, memberRole)
    res.status(201).json({ success: true, data: member })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/orgs/:id/members/:userId */
router.delete('/:id/members/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const role = await orgService.checkMembership(param(req, 'id'), req.userId!)
    if (!role || !['owner', 'admin'].includes(role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' })
      return
    }
    await orgService.removeMember(param(req, 'id'), param(req, 'userId'))
    res.json({ success: true, message: 'Member removed' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
