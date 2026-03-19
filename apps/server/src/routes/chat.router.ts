import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { claudeService } from '../services/claude.service.js'
import { projectService } from '../services/project.service.js'
import { sessionService } from '../services/session.service.js'
import { orchestratorService } from '../services/orchestrator.service.js'
import { agentService } from '../services/agent.service.js'
import { accountService } from '../services/account.service.js'
import { broadcaster } from '../ws/broadcaster.js'

const router = Router()
router.use(authMiddleware)

/** POST /api/chat/send - Send message to Claude */
router.post('/send', async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId, content, mode, agentId, images, effort } = req.body as {
      sessionId?: string
      content?: string
      mode?: string
      agentId?: string
      images?: { data: string; mimeType: string; name?: string }[]
      effort?: string
    }

    if (!sessionId || !content) {
      res.status(400).json({ success: false, error: 'sessionId and content are required' })
      return
    }

    // Get session and project
    const session = await sessionService.getById(sessionId, req.userId!)
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }

    const project = await projectService.getById(session.projectId, req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    // Resolve agent context: check built-in agents first, then DB agents
    let systemPrompt: string | undefined
    let agentModel: string | undefined

    if (agentId) {
      // Try built-in agent first
      const builtInAgent = orchestratorService.getAgent(agentId)
      if (builtInAgent) {
        systemPrompt = builtInAgent.systemPrompt
        agentModel = builtInAgent.model
        console.log(`[Chat] Using built-in agent: ${builtInAgent.name} (${builtInAgent.id})`)
      } else {
        // Try DB agent
        const dbAgent = await agentService.getById(agentId)
        if (dbAgent?.systemPrompt) {
          systemPrompt = dbAgent.systemPrompt
          agentModel = dbAgent.model
          console.log(`[Chat] Using custom agent: ${dbAgent.name} (${dbAgent.id})`)
        }
      }
    }

    // Write base64 images to temp files
    let imagePaths: string[] | undefined
    if (images && images.length > 0) {
      const tmpDir = '/tmp/axy-chat-images'
      await fs.mkdir(tmpDir, { recursive: true })
      imagePaths = []
      for (const img of images) {
        const ext = img.mimeType.split('/')[1] || 'png'
        const filename = `${crypto.randomUUID()}.${ext}`
        const filePath = path.join(tmpDir, filename)
        const buffer = Buffer.from(img.data, 'base64')
        await fs.writeFile(filePath, buffer)
        imagePaths.push(filePath)
      }
    }

    // Check that Claude auth is available (API key OR CLI login)
    const claudeApiKey = await accountService.resolveClaudeApiKey(req.userId!, session.projectId)
    if (!claudeApiKey && !process.env.ANTHROPIC_API_KEY) {
      // Check if CLI is logged in
      let cliLoggedIn = false
      try {
        const { execSync } = await import('child_process')
        const result = execSync('claude auth status', { timeout: 3000, encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' } })
        cliLoggedIn = JSON.parse(result).loggedIn === true
      } catch { /* CLI not available */ }
      if (!cliLoggedIn) {
        res.status(400).json({
          success: false,
          error: 'Claude not configured. Sign in from Settings or run "claude auth login" in the terminal.',
        })
        return
      }
    }

    // Auto-subscribe user's WS connections to this session BEFORE emitting events
    broadcaster.subscribeUserToSession(req.userId!, sessionId)

    // Start async chat (streams via WebSocket)
    claudeService.sendMessage({
      sessionId,
      userId: req.userId!,
      content,
      projectId: session.projectId,
      projectPath: project.localPath,
      model: agentModel || session.model,
      mode: mode || session.mode,
      systemPrompt,
      permissionMode: project.permissionMode,
      imagePaths,
      cliSessionId: session.cliSessionId,
      effort: effort as 'low' | 'medium' | 'high' | 'max' | undefined,
    })

    res.json({ success: true, data: { streaming: true } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/chat/stop - Stop generation */
router.post('/stop', async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.body
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'sessionId is required' })
      return
    }
    const stopped = claudeService.stopSession(sessionId)
    res.json({ success: true, data: { stopped } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
