import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { taskService } from '../services/task.service.js'

const router = Router()
router.use(authMiddleware)

function param(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val || ''
}

/** GET /api/tasks?projectId=xxx - List tasks for a project */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = req.query.projectId as string
    const sessionId = req.query.sessionId as string

    if (sessionId) {
      const tasks = await taskService.listBySession(sessionId, req.userId!)
      res.json({ success: true, data: tasks })
      return
    }

    if (!projectId) {
      res.status(400).json({ success: false, error: 'projectId or sessionId query param is required' })
      return
    }

    const tasks = await taskService.list(projectId, req.userId!)
    res.json({ success: true, data: tasks })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/tasks/:id - Get a task */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const task = await taskService.getById(param(req.params.id), req.userId!)
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }
    res.json({ success: true, data: task })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/tasks - Create a task */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId, projectId, type, title, description, command, metadataJson } = req.body

    if (!projectId || !title) {
      res.status(400).json({ success: false, error: 'projectId and title are required' })
      return
    }

    const task = await taskService.create({
      sessionId,
      userId: req.userId!,
      projectId,
      type,
      title,
      description,
      command,
      metadataJson,
    })

    res.status(201).json({ success: true, data: task })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/tasks/:id - Update a task */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { status, result, error, progress } = req.body
    const task = await taskService.updateStatus(
      param(req.params.id),
      req.userId!,
      status,
      { result, error, progress }
    )
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }
    res.json({ success: true, data: task })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/tasks/schedule - Create a scheduled/recurring task */
router.post('/schedule', async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, title, description, cronExpression, command } = req.body

    if (!projectId || !title || !cronExpression) {
      res.status(400).json({ success: false, error: 'projectId, title, and cronExpression are required' })
      return
    }

    // Validate cron expression has exactly 5 fields
    const cronParts = cronExpression.trim().split(/\s+/)
    if (cronParts.length !== 5) {
      res.status(400).json({ success: false, error: 'cronExpression must have exactly 5 fields (minute hour dayOfMonth month dayOfWeek)' })
      return
    }

    const task = await taskService.scheduleTask({
      userId: req.userId!,
      projectId,
      title,
      description,
      command,
      cronExpression,
    })

    res.status(201).json({ success: true, data: task })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/tasks/:id/cancel - Cancel a task */
router.post('/:id/cancel', async (req: AuthenticatedRequest, res) => {
  try {
    taskService.cancelProcess(param(req.params.id))
    const task = await taskService.cancel(param(req.params.id), req.userId!)
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }
    res.json({ success: true, data: task })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/tasks/:id - Delete a task */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await taskService.delete(param(req.params.id), req.userId!)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
