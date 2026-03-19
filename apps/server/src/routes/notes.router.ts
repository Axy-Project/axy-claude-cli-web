import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { noteService } from '../services/note.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/notes?projectId=xxx */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = req.query.projectId as string | undefined
    const notes = await noteService.listByUser(req.userId!, projectId)
    res.json({ success: true, data: notes })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/notes/:id */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const note = await noteService.getById(param(req, 'id'), req.userId!)
    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' })
      return
    }
    res.json({ success: true, data: note })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/notes */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const note = await noteService.create(req.userId!, req.body)
    res.status(201).json({ success: true, data: note })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PATCH /api/notes/:id */
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const note = await noteService.update(param(req, 'id'), req.userId!, req.body)
    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' })
      return
    }
    res.json({ success: true, data: note })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/notes/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await noteService.delete(param(req, 'id'), req.userId!)
    res.json({ success: true, message: 'Note deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
