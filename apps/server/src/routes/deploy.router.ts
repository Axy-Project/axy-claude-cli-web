import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { deployService } from '../services/deploy.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/deploy/projects/:projectId/pipelines */
router.get('/projects/:projectId/pipelines', async (req: AuthenticatedRequest, res) => {
  try {
    const pipelines = await deployService.listPipelines(param(req, 'projectId'), req.userId!)
    res.json({ success: true, data: pipelines })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/deploy/projects/:projectId/pipelines */
router.post('/projects/:projectId/pipelines', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, branchPattern, sftpHost, sftpPort, sftpUsername, sftpPassword, sftpPrivateKey, sftpRemotePath, sftpSourcePath, preDeployCommand, webhookUrl, webhookType } = req.body
    if (!name || !branchPattern || !sftpHost || !sftpUsername || !sftpRemotePath) {
      res.status(400).json({ success: false, error: 'name, branchPattern, sftpHost, sftpUsername, and sftpRemotePath are required' })
      return
    }
    if (!sftpPassword && !sftpPrivateKey) {
      res.status(400).json({ success: false, error: 'Either sftpPassword or sftpPrivateKey is required' })
      return
    }
    const pipeline = await deployService.createPipeline(param(req, 'projectId'), req.userId!, {
      name, branchPattern, sftpHost, sftpPort, sftpUsername, sftpPassword, sftpPrivateKey, sftpRemotePath, sftpSourcePath, preDeployCommand, webhookUrl, webhookType,
    })
    res.status(201).json({ success: true, data: pipeline })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/deploy/pipelines/:pipelineId */
router.put('/pipelines/:pipelineId', async (req: AuthenticatedRequest, res) => {
  try {
    const pipeline = await deployService.updatePipeline(param(req, 'pipelineId'), req.userId!, req.body)
    if (!pipeline) {
      res.status(404).json({ success: false, error: 'Pipeline not found' })
      return
    }
    res.json({ success: true, data: pipeline })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/deploy/pipelines/:pipelineId */
router.delete('/pipelines/:pipelineId', async (req: AuthenticatedRequest, res) => {
  try {
    const deleted = await deployService.deletePipeline(param(req, 'pipelineId'), req.userId!)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Pipeline not found' })
      return
    }
    res.json({ success: true, message: 'Pipeline deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/deploy/pipelines/:pipelineId/trigger */
router.post('/pipelines/:pipelineId/trigger', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await deployService.manualTrigger(param(req, 'pipelineId'), req.userId!)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/deploy/projects/:projectId/runs */
router.get('/projects/:projectId/runs', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20
    const runs = await deployService.getRunHistory(param(req, 'projectId'), req.userId!, limit)
    res.json({ success: true, data: runs })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/deploy/projects/:projectId/pipelines/quick - Quick create with minimal input */
router.post('/projects/:projectId/pipelines/quick', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, branch, host, port, username, password, privateKey, remotePath, sourcePath, preCommand, webhookUrl, webhookType } = req.body
    if (!name || !branch || !host || !username || !remotePath) {
      res.status(400).json({ success: false, error: 'name, branch, host, username, and remotePath are required' })
      return
    }
    if (!password && !privateKey) {
      // Allow creation without password - user can add it later via edit
      const pipeline = await deployService.createPipeline(param(req, 'projectId'), req.userId!, {
        name,
        branchPattern: branch,
        sftpHost: host,
        sftpPort: port || 22,
        sftpUsername: username,
        sftpPassword: 'CHANGE_ME',
        sftpRemotePath: remotePath,
        sftpSourcePath: sourcePath || '.',
        preDeployCommand: preCommand,
        webhookUrl,
        webhookType: webhookType || 'custom',
      })
      res.status(201).json({ success: true, data: pipeline, message: 'Pipeline created. Edit it in Project Settings to set the SFTP password.' })
      return
    }
    const pipeline = await deployService.createPipeline(param(req, 'projectId'), req.userId!, {
      name,
      branchPattern: branch,
      sftpHost: host,
      sftpPort: port || 22,
      sftpUsername: username,
      sftpPassword: password,
      sftpPrivateKey: privateKey,
      sftpRemotePath: remotePath,
      sftpSourcePath: sourcePath || '.',
      preDeployCommand: preCommand,
      webhookUrl,
      webhookType: webhookType || 'custom',
    })
    res.status(201).json({ success: true, data: pipeline })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
