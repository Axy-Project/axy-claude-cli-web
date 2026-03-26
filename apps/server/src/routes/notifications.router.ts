import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { notificationService } from '../services/notification.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/notifications — List user's notifications */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const unreadOnly = req.query.unread === 'true'
    const limit = parseInt(req.query.limit as string) || 50
    const notifications = await notificationService.list(req.userId!, { limit, unreadOnly })
    const unreadCount = await notificationService.unreadCount(req.userId!)
    res.json({ success: true, data: { notifications, unreadCount } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/notifications/count — Get unread count */
router.get('/count', async (req: AuthenticatedRequest, res) => {
  try {
    const count = await notificationService.unreadCount(req.userId!)
    res.json({ success: true, data: { count } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/notifications/:id/read — Mark notification as read */
router.post('/:id/read', async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.markRead(req.userId!, req.params.id as string)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/notifications/read-all — Mark all as read */
router.post('/read-all', async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.markAllRead(req.userId!)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/notifications/:id — Delete notification */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.delete(req.userId!, req.params.id as string)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
