import { Router } from 'express'
import fs from 'fs/promises'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { gitService } from '../services/git.service.js'
import { projectService } from '../services/project.service.js'
import { accountService } from '../services/account.service.js'
import { deployService } from '../services/deploy.service.js'

const router = Router()
router.use(authMiddleware)

/** Helper to get project path */
async function getProjectPath(projectId: string, userId: string): Promise<string | null> {
  const project = await projectService.getById(projectId, userId)
  return project?.localPath || null
}

/** POST /api/git/clone */
router.post('/clone', async (req: AuthenticatedRequest, res) => {
  try {
    const { repoUrl, projectId, branch } = req.body
    const projectPath = await getProjectPath(projectId, req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    // Remove the git-inited empty directory so clone can create it fresh
    await fs.rm(projectPath, { recursive: true, force: true })

    // Resolve GitHub token for authenticated clone (private repos)
    const token = await accountService.resolveGitHubToken(req.userId!, projectId) || undefined
    await gitService.clone(repoUrl, projectPath, branch, token)
    res.json({ success: true, message: 'Repository cloned' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:projectId/git/status */
router.get('/projects/:projectId/status', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const status = await gitService.status(projectPath)
    res.json({ success: true, data: status })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:projectId/git/branches */
router.get('/projects/:projectId/branches', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const branches = await gitService.branches(projectPath)
    res.json({ success: true, data: branches })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/checkout */
router.post('/projects/:projectId/checkout', async (req: AuthenticatedRequest, res) => {
  try {
    const { branch } = req.body
    if (!branch) {
      res.status(400).json({ success: false, error: 'branch is required' })
      return
    }
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const result = await gitService.checkout(projectPath, branch)
    const message = result.conflicts
      ? `Switched to ${branch} — stash pop had conflicts, check working tree.`
      : result.stashApplied
        ? `Switched to ${branch} with changes preserved.`
        : `Switched to ${branch}`
    res.json({ success: true, message, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/merge */
router.post('/projects/:projectId/merge', async (req: AuthenticatedRequest, res) => {
  try {
    const { fromBranch } = req.body
    if (!fromBranch) {
      res.status(400).json({ success: false, error: 'fromBranch is required' })
      return
    }
    const projectId = param(req, 'projectId')
    const projectPath = await getProjectPath(projectId, req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    await gitService.merge(projectPath, fromBranch)
    res.json({ success: true, message: `Merged ${fromBranch} successfully` })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/commit */
router.post('/projects/:projectId/commit', async (req: AuthenticatedRequest, res) => {
  try {
    const { message, files } = req.body
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const result = await gitService.commit(projectPath, message, files)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/push */
router.post('/projects/:projectId/push', async (req: AuthenticatedRequest, res) => {
  try {
    const { remote, branch } = req.body
    const projectId = param(req, 'projectId')
    const projectPath = await getProjectPath(projectId, req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const token = await accountService.resolveGitHubToken(req.userId!, projectId) || undefined
    await gitService.push(projectPath, remote, branch, token)

    // Trigger deploy pipelines matching this branch (fire-and-forget)
    const currentBranch = branch || (await gitService.status(projectPath)).branch
    deployService.triggerMatchingPipelines(projectId, currentBranch, req.userId!).catch(() => {})

    res.json({ success: true, message: 'Pushed successfully' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/pull */
router.post('/projects/:projectId/pull', async (req: AuthenticatedRequest, res) => {
  try {
    const { remote, branch } = req.body
    const projectId = param(req, 'projectId')
    const projectPath = await getProjectPath(projectId, req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const token = await accountService.resolveGitHubToken(req.userId!, projectId) || undefined
    await gitService.pull(projectPath, remote, branch, token)
    res.json({ success: true, message: 'Pulled successfully' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/discard - Discard uncommitted changes */
router.post('/projects/:projectId/discard', async (req: AuthenticatedRequest, res) => {
  try {
    const { file } = req.body || {}
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    if (file) {
      await gitService.discardFile(projectPath, file)
      res.json({ success: true, message: `Discarded changes to ${file}` })
    } else {
      await gitService.discardAll(projectPath)
      res.json({ success: true, message: 'All changes discarded' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/link-repo - Link a GitHub repo to this project */
router.post('/projects/:projectId/link-repo', async (req: AuthenticatedRequest, res) => {
  try {
    const { repoUrl } = req.body
    if (!repoUrl) {
      res.status(400).json({ success: false, error: 'repoUrl is required' })
      return
    }
    const projectId = param(req, 'projectId')
    const projectPath = await getProjectPath(projectId, req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    // Set git remote
    await gitService.linkRemote(projectPath, repoUrl)

    // Update project record with GitHub info
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)
    const fullName = match ? match[1] : undefined
    await projectService.update(projectId, req.userId!, {
      githubRepoUrl: repoUrl,
      githubRepoFullName: fullName,
    } as any)

    // Initial push to set up remote tracking
    let pushError: string | undefined
    try {
      const token = await accountService.resolveGitHubToken(req.userId!, projectId) || undefined
      await gitService.push(projectPath, 'origin', undefined, token)
    } catch (err) {
      pushError = (err as Error).message
    }

    res.json({
      success: true,
      message: pushError ? `Repo linked but push failed: ${pushError}` : 'Repository linked and pushed',
      data: { repoUrl, fullName, pushError },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/fetch - Fetch remote refs */
router.post('/projects/:projectId/fetch', async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = param(req, 'projectId')
    const projectPath = await getProjectPath(projectId, req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    await gitService.fetch(projectPath)
    res.json({ success: true, message: 'Fetched successfully' })
  } catch (error) {
    res.json({ success: true, message: 'Fetch skipped (no remote or offline)' })
  }
})

/** POST /api/projects/:projectId/git/stage */
router.post('/projects/:projectId/stage', async (req: AuthenticatedRequest, res) => {
  try {
    const { files } = req.body
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    await gitService.stage(projectPath, files || ['.'])
    res.json({ success: true, message: 'Files staged' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/unstage */
router.post('/projects/:projectId/unstage', async (req: AuthenticatedRequest, res) => {
  try {
    const { files } = req.body
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: 'files array is required' })
      return
    }
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    await gitService.unstage(projectPath, files)
    res.json({ success: true, message: 'Files unstaged' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/create-branch */
router.post('/projects/:projectId/create-branch', async (req: AuthenticatedRequest, res) => {
  try {
    const { branch } = req.body
    if (!branch) {
      res.status(400).json({ success: false, error: 'branch name is required' })
      return
    }
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    await gitService.createBranch(projectPath, branch)
    res.json({ success: true, message: `Created and switched to branch: ${branch}` })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/projects/:projectId/git/generate-message */
router.post('/projects/:projectId/generate-message', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    // Get the diff of staged changes (or all changes if nothing staged)
    const stagedDiff = await gitService.diff(projectPath, true)
    const workingDiff = stagedDiff || await gitService.diff(projectPath, false)

    if (!workingDiff) {
      res.json({ success: true, data: { message: '' } })
      return
    }

    // Truncate diff to avoid huge payloads - keep first 3000 chars
    const truncatedDiff = workingDiff.length > 3000 ? workingDiff.slice(0, 3000) + '\n... (truncated)' : workingDiff

    // Generate commit message using a simple heuristic (no AI dependency)
    const message = generateCommitMessage(truncatedDiff)
    res.json({ success: true, data: { message } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** Simple commit message generator from diff */
function generateCommitMessage(diff: string): string {
  const files: string[] = []
  const additions: string[] = []
  const deletions: string[] = []

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/)
      if (match) files.push(match[1])
    } else if (line.startsWith('+') && !line.startsWith('+++') && !line.startsWith('++')) {
      additions.push(line.slice(1).trim())
    } else if (line.startsWith('-') && !line.startsWith('---') && !line.startsWith('--')) {
      deletions.push(line.slice(1).trim())
    }
  }

  if (files.length === 0) return 'chore: update files'

  // Detect type based on files and content
  let type = 'chore'
  const allContent = [...additions, ...deletions].join(' ').toLowerCase()
  if (additions.length > deletions.length * 2) type = 'feat'
  else if (allContent.includes('fix') || allContent.includes('bug') || allContent.includes('error')) type = 'fix'
  else if (files.some(f => f.includes('test') || f.includes('spec'))) type = 'test'
  else if (files.some(f => f.includes('readme') || f.includes('doc'))) type = 'docs'
  else if (deletions.length > additions.length) type = 'refactor'

  // Summarize scope
  const dirs = [...new Set(files.map(f => f.split('/').slice(0, -1).join('/') || '.'))]
  const scope = dirs.length === 1 && dirs[0] !== '.' ? dirs[0].split('/').pop() : undefined
  const scopeStr = scope ? `(${scope})` : ''

  // Summarize what changed
  const fileCount = files.length
  const summary = fileCount <= 3
    ? files.map(f => f.split('/').pop()).join(', ')
    : `${fileCount} files`

  return `${type}${scopeStr}: update ${summary}`
}

/** GET /api/projects/:projectId/git/log */
router.get('/projects/:projectId/log', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const maxCount = parseInt(req.query.maxCount as string) || 50
    const log = await gitService.log(projectPath, maxCount)
    res.json({ success: true, data: log })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/projects/:projectId/git/diff */
router.get('/projects/:projectId/diff', async (req: AuthenticatedRequest, res) => {
  try {
    const projectPath = await getProjectPath(param(req, 'projectId'), req.userId!)
    if (!projectPath) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const staged = req.query.staged === 'true'
    const diff = await gitService.diff(projectPath, staged)
    res.json({ success: true, data: diff })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
