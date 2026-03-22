import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { mkdirSync } from 'fs'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { projectService } from '../services/project.service.js'
import { agentService } from '../services/agent.service.js'
import { skillService } from '../services/skill.service.js'
import { mcpService } from '../services/mcp.service.js'
import { config } from '../config.js'

const router = Router()
router.use(authMiddleware)

// Ensure temp upload directory exists
const UPLOAD_TMP = path.join(config.projectsDir, '..', '.tmp-uploads')
mkdirSync(UPLOAD_TMP, { recursive: true })

// Multer for file uploads - store in temp inside data dir (same filesystem to avoid cross-device issues)
const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '500', 10) * 1024 * 1024
const upload = multer({
  dest: UPLOAD_TMP,
  limits: { fileSize: MAX_UPLOAD_SIZE },
})

/** GET /api/projects */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const projects = await projectService.list(req.userId!, req.query as Record<string, string>)
    res.json({ success: true, data: projects })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:id */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'id'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    res.json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.create(req.userId!, req.body)
    res.status(201).json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/upload - Upload folder as project */
router.post('/upload', upload.array('files', 5000), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, permissionMode } = req.body
    const files = req.files as Express.Multer.File[]

    if (!name || !files || files.length === 0) {
      res.status(400).json({ success: false, error: 'name and files are required' })
      return
    }

    // Create project first to get the localPath
    const project = await projectService.create(req.userId!, {
      name,
      description,
      permissionMode: permissionMode || 'default',
    })

    // Move uploaded files to project directory, preserving relative paths
    for (const file of files) {
      // The originalname contains the relative path from the webkitRelativePath
      const relativePath = file.originalname
      const destPath = path.join(project.localPath, relativePath)
      const destDir = path.dirname(destPath)

      await fs.mkdir(destDir, { recursive: true })
      // Try rename first (fast, atomic, works on same filesystem)
      // Fall back to copy+unlink for cross-device scenarios
      try {
        await fs.rename(file.path, destPath)
      } catch {
        await fs.copyFile(file.path, destPath)
        await fs.unlink(file.path).catch(() => {})
      }
    }

    // Clean up any remaining temp files
    try {
      const tmpFiles = await fs.readdir(UPLOAD_TMP)
      for (const f of tmpFiles) {
        await fs.unlink(path.join(UPLOAD_TMP, f)).catch(() => {})
      }
    } catch { /* ignore */ }

    res.status(201).json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/upload-json - Upload folder as project (base64 JSON, no multipart) */
router.post('/upload-json', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, permissionMode, files } = req.body as {
      name: string
      description?: string
      permissionMode?: string
      files: { path: string; data: string }[] // data = base64 encoded
    }

    if (!name || !files || files.length === 0) {
      res.status(400).json({ success: false, error: 'name and files are required' })
      return
    }

    // Create project first to get the localPath
    const project = await projectService.create(req.userId!, {
      name,
      description,
      permissionMode: (permissionMode || 'default') as 'default' | 'accept_edits' | 'bypass' | 'plan',
    })

    // Write files to project directory
    let written = 0
    for (const file of files) {
      try {
        const destPath = path.join(project.localPath, file.path)
        const destDir = path.dirname(destPath)
        await fs.mkdir(destDir, { recursive: true })
        const buffer = Buffer.from(file.data, 'base64')
        await fs.writeFile(destPath, buffer)
        written++
      } catch { /* skip individual file errors */ }
    }

    res.status(201).json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/projects/:id */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.update(param(req, 'id'), req.userId!, req.body)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    res.json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/projects/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const deleted = await projectService.delete(param(req, 'id'), req.userId!)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    res.json({ success: true, message: 'Project deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:id/claude-md - Read CLAUDE.md from project filesystem */
router.get('/:id/claude-md', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'id'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    // Try to read CLAUDE.md from the project directory
    const claudeMdPath = path.join(project.localPath, 'CLAUDE.md')

    let content = ''
    let source = 'none' as 'file' | 'database' | 'none'

    try {
      content = await fs.readFile(claudeMdPath, 'utf-8')
      source = 'file'
    } catch {
      // File doesn't exist, try database
      if (project.claudeMdContent) {
        content = project.claudeMdContent
        source = 'database'
      }
    }

    res.json({ success: true, data: { content, source, path: claudeMdPath } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/projects/:id/claude-md - Write CLAUDE.md to project filesystem */
router.put('/:id/claude-md', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'id'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    const { content } = req.body as { content: string }
    const claudeMdPath = path.join(project.localPath, 'CLAUDE.md')

    // Write to filesystem
    await fs.writeFile(claudeMdPath, content, 'utf-8')

    // Also update in database
    await projectService.update(project.id, req.userId!, { claudeMdContent: content } as never)

    res.json({ success: true, data: { content, path: claudeMdPath } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:id/export - Export project config (agents, skills, mcp servers, settings) as JSON */
router.get('/:id/export', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'id'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    const [agents, skills, mcpServers] = await Promise.all([
      agentService.list(req.userId!),
      skillService.list(req.userId!),
      mcpService.listByProject(project.id),
    ])

    const exportData = {
      name: project.name,
      description: project.description,
      settings: project.settingsJson,
      permissionMode: project.permissionMode,
      agents: agents.map((a: Record<string, unknown>) => ({
        name: a.name,
        description: a.description,
        icon: a.icon,
        color: a.color,
        role: a.role,
        model: a.model,
        systemPrompt: a.systemPrompt,
        allowedToolsJson: a.allowedToolsJson,
        disallowedToolsJson: a.disallowedToolsJson,
        maxTokens: a.maxTokens,
        temperature: a.temperature,
        extendedThinking: a.extendedThinking,
        thinkingBudget: a.thinkingBudget,
        permissionMode: a.permissionMode,
      })),
      skills: skills.map((s: Record<string, unknown>) => ({
        name: s.name,
        description: s.description,
        trigger: s.trigger,
        promptTemplate: s.promptTemplate,
        category: s.category,
        allowedToolsJson: s.allowedToolsJson,
        isGlobal: s.isGlobal,
      })),
      mcpServers: mcpServers.map((m: Record<string, unknown>) => ({
        name: m.name,
        type: m.type,
        command: m.command,
        argsJson: m.argsJson,
        envJson: m.envJson,
        isEnabled: m.isEnabled,
      })),
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_config.json"`
    )
    res.json({ success: true, data: exportData })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:id/import-config - Import project config from JSON */
router.post('/:id/import-config', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'id'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    const importData = req.body as {
      agents?: Record<string, unknown>[]
      skills?: Record<string, unknown>[]
      mcpServers?: Record<string, unknown>[]
      settings?: Record<string, unknown>
      permissionMode?: string
    }

    const results = { agents: 0, skills: 0, mcpServers: 0 }

    // Import agents
    if (importData.agents && Array.isArray(importData.agents)) {
      for (const agent of importData.agents) {
        await agentService.create(req.userId!, {
          name: agent.name as string,
          description: agent.description as string | undefined,
          icon: agent.icon as string | undefined,
          color: agent.color as string | undefined,
          role: agent.role as string | undefined,
          model: agent.model as string | undefined,
          systemPrompt: agent.systemPrompt as string | undefined,
          allowedToolsJson: agent.allowedToolsJson as string[] | undefined,
          disallowedToolsJson: agent.disallowedToolsJson as string[] | undefined,
          maxTokens: agent.maxTokens as number | undefined,
          temperature: agent.temperature as number | undefined,
          extendedThinking: agent.extendedThinking as boolean | undefined,
          thinkingBudget: agent.thinkingBudget as number | undefined,
          permissionMode: agent.permissionMode as string | undefined,
        } as never)
        results.agents++
      }
    }

    // Import skills
    if (importData.skills && Array.isArray(importData.skills)) {
      for (const skill of importData.skills) {
        await skillService.create(req.userId!, {
          name: skill.name as string,
          description: skill.description as string,
          trigger: skill.trigger as string | undefined,
          promptTemplate: skill.promptTemplate as string,
          category: skill.category as string | undefined,
          allowedToolsJson: skill.allowedToolsJson as string[] | undefined,
          isGlobal: skill.isGlobal as boolean | undefined,
        })
        results.skills++
      }
    }

    // Import MCP servers
    if (importData.mcpServers && Array.isArray(importData.mcpServers)) {
      for (const server of importData.mcpServers) {
        await mcpService.create({
          projectId: project.id,
          name: server.name as string,
          type: server.type as string | undefined,
          command: server.command as string,
          argsJson: server.argsJson as string[] | undefined,
          envJson: server.envJson as Record<string, string> | undefined,
        })
        results.mcpServers++
      }
    }

    // Update project settings if provided
    if (importData.settings || importData.permissionMode) {
      const updateData: Record<string, unknown> = {}
      if (importData.settings) updateData.settingsJson = importData.settings
      if (importData.permissionMode) updateData.permissionMode = importData.permissionMode
      await projectService.update(project.id, req.userId!, updateData as never)
    }

    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:id/export-backup — Download full project backup as zip */
router.get('/:id/export-backup', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'id'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    const archiver = (await import('archiver')).default
    const { db, schema } = await import('../db/index.js')
    const { eq } = await import('drizzle-orm')

    // Collect all related DB data
    const sessions = await db.select().from(schema.sessions).where(eq(schema.sessions.projectId, project.id))
    const sessionIds = sessions.map((s: any) => s.id)
    let messages: any[] = []
    if (sessionIds.length > 0) {
      const { inArray } = await import('drizzle-orm')
      messages = await db.select().from(schema.messages).where(inArray(schema.messages.sessionId, sessionIds))
    }
    const tasks = await db.select().from(schema.tasks).where(eq(schema.tasks.projectId, project.id))
    const notes = await db.select().from(schema.notes).where(eq(schema.notes.projectId, project.id))
    const mcpServers = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.projectId, project.id))

    const manifest = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      project: { name: project.name, description: project.description, permissionMode: project.permissionMode, defaultBranch: project.defaultBranch, githubRepoUrl: project.githubRepoUrl },
      sessions,
      messages,
      tasks,
      notes,
      mcpServers,
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}-backup.zip"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.pipe(res)

    // Add manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

    // Add project files
    try {
      const { existsSync } = await import('fs')
      if (existsSync(project.localPath)) {
        archive.directory(project.localPath, 'files')
      }
    } catch { /* no files */ }

    await archive.finalize()
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  }
})

/** POST /api/projects/import-backup — Import project from backup zip */
router.post('/import-backup', upload.single('backup'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No backup file uploaded' })
      return
    }

    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(req.file.path)
    const manifestEntry = zip.getEntry('manifest.json')

    if (!manifestEntry) {
      res.status(400).json({ success: false, error: 'Invalid backup: missing manifest.json' })
      return
    }

    const manifest = JSON.parse(manifestEntry.getData().toString('utf-8'))
    const projectInfo = manifest.project

    // Create new project
    const project = await projectService.create(req.userId!, {
      name: projectInfo.name + ' (imported)',
      description: projectInfo.description,
      permissionMode: projectInfo.permissionMode || 'default',
    })

    // Extract files
    const filesEntries = zip.getEntries().filter((e: any) => e.entryName.startsWith('files/') && !e.isDirectory)
    for (const entry of filesEntries) {
      const relativePath = entry.entryName.replace('files/', '')
      if (!relativePath) continue
      const destPath = path.join(project.localPath, relativePath)
      await fs.mkdir(path.dirname(destPath), { recursive: true })
      await fs.writeFile(destPath, entry.getData())
    }

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {})

    res.status(201).json({
      success: true,
      data: project,
      meta: {
        sessions: manifest.sessions?.length || 0,
        messages: manifest.messages?.length || 0,
        files: filesEntries.length,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
