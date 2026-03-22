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

/** POST /api/orgs/:id/members — Add by email, @github username, or userId */
router.post('/:id/members', async (req: AuthenticatedRequest, res) => {
  try {
    const role = await orgService.checkMembership(param(req, 'id'), req.userId!)
    if (!role || !['owner', 'admin'].includes(role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' })
      return
    }
    const { userId, email, githubUsername, role: memberRole } = req.body

    // Resolve user by email or GitHub username if userId not provided
    let resolvedUserId = userId
    if (!resolvedUserId && (email || githubUsername)) {
      const { db, schema } = await import('../db/index.js')
      const { eq } = await import('drizzle-orm')
      const [user] = email
        ? await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1)
        : await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.githubUsername, githubUsername)).limit(1)
      if (!user) {
        res.status(404).json({ success: false, error: `User not found: ${email || githubUsername}` })
        return
      }
      resolvedUserId = user.id
    }

    if (!resolvedUserId) {
      res.status(400).json({ success: false, error: 'Provide email, githubUsername, or userId' })
      return
    }

    const member = await orgService.addMember(param(req, 'id'), resolvedUserId, memberRole)
    res.status(201).json({ success: true, data: member })
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      res.status(409).json({ success: false, error: 'User is already a member' })
      return
    }
    res.status(500).json({ success: false, error: msg })
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
