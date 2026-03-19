import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { activityService } from '../services/activity.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/activity?limit=30 - Get recent activity feed */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100)
    const activity = await activityService.getRecentActivity(req.userId!, limit)
    res.json({ success: true, data: activity })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
