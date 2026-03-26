import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { teamMessageService } from '../services/team-message.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/team-messages/:orgId — List messages for an org */
router.get('/:orgId', async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.params.orgId as string
    const limit = parseInt(req.query.limit as string) || 50
    const before = req.query.before as string | undefined
    const messages = await teamMessageService.list(orgId, { limit, before })
    res.json({ success: true, data: messages })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/team-messages/:orgId — Send a message */
router.post('/:orgId', async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.params.orgId as string
    const { content, replyToId, linkedSessionId, linkedProjectId } = req.body
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Content is required' })
    }
    const message = await teamMessageService.send({
      orgId,
      senderId: req.userId!,
      content: content.trim(),
      replyToId,
      linkedSessionId,
      linkedProjectId,
    })
    res.json({ success: true, data: message })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/team-messages/:id — Delete own message */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const deleted = await teamMessageService.delete(req.params.id as string, req.userId!)
    if (!deleted) {
      return res.status(403).json({ success: false, error: 'Cannot delete this message' })
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
