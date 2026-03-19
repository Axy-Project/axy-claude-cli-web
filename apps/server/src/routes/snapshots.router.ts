import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { snapshotService } from '../services/snapshot.service.js'
import { projectService } from '../services/project.service.js'

const router = Router()
router.use(authMiddleware)

/** Helper to get project path */
async function getProjectPath(projectId: string, userId: string): Promise<string | null> {
  const project = await projectService.getById(projectId, userId)
  return project?.localPath || null
}

/** GET /api/snapshots/project/:projectId - List all snapshots */
router.get('/project/:projectId', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const snapshots = await snapshotService.list(projectPath)
    res.json({ success: true, data: snapshots })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/snapshots/project/:projectId - Create a snapshot */
router.post('/project/:projectId', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Snapshot name is required' })
      return
    }
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const snapshot = await snapshotService.create(projectPath, name.trim(), description?.trim())
    res.json({ success: true, data: snapshot })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/snapshots/project/:projectId/restore/:snapshotId - Restore a snapshot */
router.post('/project/:projectId/restore/:snapshotId', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const snapshotId = decodeURIComponent(param(req, 'snapshotId'))
    const branchName = await snapshotService.restore(projectPath, snapshotId)
    res.json({ success: true, data: { branchName } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/snapshots/project/:projectId/:snapshotId - Delete a snapshot */
router.delete('/project/:projectId/:snapshotId', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const snapshotId = decodeURIComponent(param(req, 'snapshotId'))
    await snapshotService.delete(projectPath, snapshotId)
    res.json({ success: true, data: null })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/snapshots/project/:projectId/diff/:snapshotId - Get diff against HEAD */
router.get('/project/:projectId/diff/:snapshotId', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const snapshotId = decodeURIComponent(param(req, 'snapshotId'))
    const diff = await snapshotService.diff(projectPath, snapshotId)
    res.json({ success: true, data: diff })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
