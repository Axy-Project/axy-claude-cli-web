import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { fileService } from '../services/file.service.js'
import { projectService } from '../services/project.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/projects/:projectId/files - Get file tree */
router.get('/projects/:projectId', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const tree = await fileService.readTree(project.localPath)
    res.json({ success: true, data: tree })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:projectId/files/read?path=... - Read file */
router.get('/projects/:projectId/read', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const filePath = req.query.path as string
    if (!filePath) {
      res.status(400).json({ success: false, error: 'path query param required' })
      return
    }
    const safePath = await fileService.validatePath(filePath, project.localPath)
    const content = await fileService.readFile(safePath)
    res.json({ success: true, data: { content } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PUT /api/projects/:projectId/files/write - Write file */
router.put('/projects/:projectId/write', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const { path: filePath, content } = req.body
    const safePath = await fileService.validatePath(filePath, project.localPath)
    await fileService.writeFile(safePath, content)
    res.json({ success: true, data: { saved: true } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/files - Create file/directory */
router.post('/projects/:projectId', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const { path: filePath, type, content } = req.body
    const safePath = await fileService.validatePath(filePath, project.localPath)
    if (type === 'directory') {
      await fileService.createDirectory(safePath)
    } else {
      await fileService.createFile(safePath, content || '')
    }
    res.status(201).json({ success: true, data: { created: filePath, type: type || 'file' } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/files/upload - Upload files (base64) */
router.post('/projects/:projectId/upload', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const { files } = req.body as {
      files: { path: string; data: string }[] // data = base64 encoded
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ success: false, error: 'files array is required' })
      return
    }
    // Write files in parallel (batches of 20 to avoid fd exhaustion)
    const results: { path: string; success: boolean; error?: string }[] = []
    const PARALLEL = 20
    for (let i = 0; i < files.length; i += PARALLEL) {
      const batch = files.slice(i, i + PARALLEL)
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const safePath = await fileService.validatePath(file.path, project.localPath)
            await fileService.writeFileBuffer(safePath, Buffer.from(file.data, 'base64'))
            return { path: file.path, success: true as const }
          } catch (err) {
            return { path: file.path, success: false as const, error: (err as Error).message }
          }
        })
      )
      results.push(...batchResults)
    }
    res.json({ success: true, data: { uploaded: results } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:projectId/siblings - List sibling projects (same user/org) */
router.get('/projects/:projectId/siblings', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    // Get all projects for this user, optionally filtered by same org
    const allProjects = await projectService.list(req.userId!, {
      orgId: project.orgId || undefined,
      pageSize: 100,
    })
    // Exclude the current project
    const siblings = allProjects
      .filter((p: { id: string }) => p.id !== project.id)
      .map((p: { id: string; name: string; description: string | null; githubRepoFullName: string | null; updatedAt: string }) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        githubRepoFullName: p.githubRepoFullName,
        updatedAt: p.updatedAt,
      }))
    res.json({ success: true, data: siblings })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:projectId/cross-ref/:targetId/tree - Read file tree from sibling */
router.get('/projects/:projectId/cross-ref/:targetId/tree', async (req: AuthenticatedRequest, res) => {
  try {
    // Verify both projects belong to the user
    const source = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!source) {
      res.status(404).json({ success: false, error: 'Source project not found' })
      return
    }
    const target = await projectService.getById(param(req, 'targetId'), req.userId!)
    if (!target) {
      res.status(404).json({ success: false, error: 'Target project not found' })
      return
    }
    const depth = parseInt(req.query.depth as string) || 3
    const tree = await fileService.readTree(target.localPath, Math.min(depth, 5))
    res.json({ success: true, data: { project: { id: target.id, name: target.name }, tree } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:projectId/cross-ref/:targetId/read?path=... - Read file from sibling */
router.get('/projects/:projectId/cross-ref/:targetId/read', async (req: AuthenticatedRequest, res) => {
  try {
    const source = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!source) {
      res.status(404).json({ success: false, error: 'Source project not found' })
      return
    }
    const target = await projectService.getById(param(req, 'targetId'), req.userId!)
    if (!target) {
      res.status(404).json({ success: false, error: 'Target project not found' })
      return
    }
    const filePath = req.query.path as string
    if (!filePath) {
      res.status(400).json({ success: false, error: 'path query param required' })
      return
    }
    const safePath = await fileService.validatePath(filePath, target.localPath)
    const content = await fileService.readFile(safePath)
    res.json({ success: true, data: { project: target.name, path: filePath, content } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/cross-ref/search - Search across sibling projects */
router.post('/projects/:projectId/cross-ref/search', async (req: AuthenticatedRequest, res) => {
  try {
    const source = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!source) {
      res.status(404).json({ success: false, error: 'Source project not found' })
      return
    }
    const { query, targetIds, filePattern } = req.body as {
      query: string
      targetIds?: string[]
      filePattern?: string // e.g. "*.ts", "*.json"
    }
    if (!query) {
      res.status(400).json({ success: false, error: 'query is required' })
      return
    }

    // Get sibling projects
    const allProjects = await projectService.list(req.userId!, {
      orgId: source.orgId || undefined,
      pageSize: 100,
    })
    const siblings = allProjects.filter((p: { id: string }) =>
      p.id !== source.id && (!targetIds || targetIds.includes(p.id))
    )

    const results: { projectId: string; projectName: string; file: string; line: number; content: string }[] = []
    const queryLower = query.toLowerCase()

    for (const sibling of siblings) {
      try {
        await searchInDir(sibling.localPath, '', sibling.id, sibling.name, queryLower, filePattern, results)
      } catch { /* skip unreadable projects */ }
      if (results.length >= 50) break // Limit results
    }

    res.json({ success: true, data: results.slice(0, 50) })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** Helper: recursively search files in a directory */
async function searchInDir(
  dirPath: string,
  relativePath: string,
  projectId: string,
  projectName: string,
  query: string,
  filePattern: string | undefined,
  results: { projectId: string; projectName: string; file: string; line: number; content: string }[],
  depth = 0
) {
  if (depth > 4 || results.length >= 50) return
  const { readdir, readFile, stat } = await import('fs/promises')
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (results.length >= 50) return
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') continue
    const full = `${dirPath}/${entry.name}`
    const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      await searchInDir(full, rel, projectId, projectName, query, filePattern, results, depth + 1)
    } else {
      // Check file pattern
      if (filePattern) {
        const ext = filePattern.replace('*', '')
        if (!entry.name.endsWith(ext)) continue
      }
      // Only search text files < 500KB
      try {
        const s = await stat(full)
        if (s.size > 500 * 1024) continue
        const content = await readFile(full, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(query)) {
            results.push({
              projectId,
              projectName,
              file: rel,
              line: i + 1,
              content: lines[i].trim().slice(0, 200),
            })
            if (results.length >= 50) return
          }
        }
      } catch { /* skip binary/unreadable files */ }
    }
  }
}

/** DELETE /api/projects/:projectId/files?path=... */
router.delete('/projects/:projectId', async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const filePath = req.query.path as string
    if (!filePath) {
      res.status(400).json({ success: false, error: 'path query param required' })
      return
    }
    const safePath = await fileService.validatePath(filePath, project.localPath)
    await fileService.delete(safePath)
    res.json({ success: true, data: { deleted: true } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
