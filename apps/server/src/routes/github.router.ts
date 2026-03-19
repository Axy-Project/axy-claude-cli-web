import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { githubService } from '../services/github.service.js'
import { accountService } from '../services/account.service.js'
import { db, schema } from '../db/index.js'
import { eq, and } from 'drizzle-orm'
import simpleGit from 'simple-git'

const router = Router()
router.use(authMiddleware)

/** Parse owner/repo from a git remote URL or "owner/repo" string */
function parseOwnerRepo(remote: string): { owner: string; repo: string } | null {
  // Handle "owner/repo" format (e.g. githubRepoFullName)
  const slashMatch = remote.match(/^([^/]+)\/([^/]+)$/)
  if (slashMatch) {
    return { owner: slashMatch[1], repo: slashMatch[2].replace(/\.git$/, '') }
  }
  // Handle https://github.com/owner/repo.git
  const httpsMatch = remote.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }
  // Handle git@github.com:owner/repo.git
  const sshMatch = remote.match(/github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }
  return null
}

/** Get a project and resolve its owner/repo from DB fields or git remote */
async function getProjectRepoInfo(projectId: string, userId: string): Promise<{
  project: typeof schema.projects.$inferSelect
  owner: string
  repo: string
} | null> {
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1)
  if (!project) return null

  // Try githubRepoFullName first
  if (project.githubRepoFullName) {
    const parsed = parseOwnerRepo(project.githubRepoFullName)
    if (parsed) return { project, ...parsed }
  }

  // Try githubRepoUrl
  if (project.githubRepoUrl) {
    const parsed = parseOwnerRepo(project.githubRepoUrl)
    if (parsed) return { project, ...parsed }
  }

  // Fall back to reading git remote from localPath
  try {
    const git = simpleGit(project.localPath)
    const remotes = await git.getRemotes(true)
    const origin = remotes.find((r) => r.name === 'origin')
    if (origin?.refs?.fetch) {
      const parsed = parseOwnerRepo(origin.refs.fetch)
      if (parsed) return { project, ...parsed }
    }
  } catch {
    // git remote not available
  }

  return null
}

/** Get GitHub token for the authenticated user (decrypted) - resolves via connected accounts */
async function getGitHubToken(userId: string, projectId?: string): Promise<string | null> {
  return accountService.resolveGitHubToken(userId, projectId)
}

/** Middleware to ensure GitHub token exists */
async function requireGitHubToken(req: AuthenticatedRequest, res: any, next: any) {
  const projectId = (req.query.projectId as string) || (req as any).params?.projectId || (req.body?.projectId as string)
  const token = await getGitHubToken(req.userId!, projectId)
  if (!token) {
    res.status(401).json({ success: false, error: 'GitHub token not found. Please re-authenticate with GitHub.' })
    return
  }
  ;(req as any).githubToken = token
  next()
}

/** GET /api/github/repos */
router.get('/repos', requireGitHubToken, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const repos = await githubService.listRepos(req.githubToken, page)
    res.json({ success: true, data: repos })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/search?q=... */
router.get('/repos/search', requireGitHubToken, async (req: any, res) => {
  try {
    const query = (req.query.q as string) || ''
    const repos = await githubService.searchRepos(req.githubToken, query)
    res.json({ success: true, data: repos })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/github/repos */
router.post('/repos', requireGitHubToken, async (req: any, res) => {
  try {
    const { name, description, private: isPrivate } = req.body
    const repo = await githubService.createRepo(req.githubToken, name, { description, private: isPrivate })
    res.status(201).json({ success: true, data: repo })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/:owner/:repo */
router.get('/repos/:owner/:repo', requireGitHubToken, async (req: any, res) => {
  try {
    const repo = await githubService.getRepo(req.githubToken, param(req, 'owner'), param(req, 'repo'))
    res.json({ success: true, data: repo })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/:owner/:repo/branches */
router.get('/repos/:owner/:repo/branches', requireGitHubToken, async (req: any, res) => {
  try {
    const branches = await githubService.listBranches(req.githubToken, param(req, 'owner'), param(req, 'repo'))
    res.json({ success: true, data: branches })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/:owner/:repo/prs */
router.get('/repos/:owner/:repo/prs', requireGitHubToken, async (req: any, res) => {
  try {
    const state = (req.query.state || 'open') as 'open' | 'closed' | 'all'
    const prs = await githubService.listPrs(req.githubToken, param(req, 'owner'), param(req, 'repo'), state)
    res.json({ success: true, data: prs })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/github/repos/:owner/:repo/prs */
router.post('/repos/:owner/:repo/prs', requireGitHubToken, async (req: any, res) => {
  try {
    const pr = await githubService.createPr(req.githubToken, param(req, 'owner'), param(req, 'repo'), req.body)
    res.status(201).json({ success: true, data: pr })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/:owner/:repo/issues */
router.get('/repos/:owner/:repo/issues', requireGitHubToken, async (req: any, res) => {
  try {
    const state = (req.query.state || 'open') as 'open' | 'closed' | 'all'
    const issues = await githubService.listIssues(req.githubToken, param(req, 'owner'), param(req, 'repo'), state)
    res.json({ success: true, data: issues })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/github/repos/create-pr - Create a PR from the current project branch */
router.post('/repos/create-pr', requireGitHubToken, async (req: any, res) => {
  try {
    const { projectId, title, body, baseBranch, headBranch } = req.body
    if (!projectId || !title) {
      res.status(400).json({ success: false, error: 'projectId and title are required' })
      return
    }

    const info = await getProjectRepoInfo(projectId, req.userId!)
    if (!info) {
      res.status(404).json({ success: false, error: 'Project not found or no GitHub repo linked' })
      return
    }

    const { project, owner, repo } = info

    // Determine head branch from param, or read current branch from git
    let head = headBranch
    if (!head) {
      try {
        const git = simpleGit(project.localPath)
        const status = await git.status()
        head = status.current
      } catch {
        res.status(400).json({ success: false, error: 'Could not determine current branch from project' })
        return
      }
    }
    if (!head) {
      res.status(400).json({ success: false, error: 'Could not determine head branch' })
      return
    }

    // Determine base branch from param, or use project default
    const base = baseBranch || project.defaultBranch || 'main'

    const pr = await githubService.createPr(req.githubToken, owner, repo, {
      title,
      body,
      head,
      base,
    })

    res.status(201).json({ success: true, data: { number: pr.number, title: pr.title, url: pr.html_url } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/:projectId/prs/:prNumber - Get a single PR status */
router.get('/repos/:projectId/prs/:prNumber', requireGitHubToken, async (req: any, res) => {
  try {
    const projectId = param(req, 'projectId')
    const prNumber = parseInt(param(req, 'prNumber'), 10)
    const info = await getProjectRepoInfo(projectId, req.userId!)
    if (!info) {
      res.status(404).json({ success: false, error: 'Project not found or no GitHub repo linked' })
      return
    }
    const pr = await githubService.getPr(req.githubToken, info.owner, info.repo, prNumber)
    res.json({ success: true, data: { number: pr.number, title: pr.title, url: pr.html_url, state: pr.state, merged: pr.merged, mergeable: pr.mergeable } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/github/repos/:projectId/prs/:prNumber/merge - Merge a PR on GitHub + pull locally */
router.post('/repos/:projectId/prs/:prNumber/merge', requireGitHubToken, async (req: any, res) => {
  try {
    const projectId = param(req, 'projectId')
    const prNumber = parseInt(param(req, 'prNumber'), 10)
    const { mergeMethod } = req.body || {}
    const info = await getProjectRepoInfo(projectId, req.userId!)
    if (!info) {
      res.status(404).json({ success: false, error: 'Project not found or no GitHub repo linked' })
      return
    }
    const { project, owner, repo } = info
    // Get PR info to know base branch
    const prInfo = await githubService.getPr(req.githubToken, owner, repo, prNumber)
    const baseBranch = prInfo.base?.ref || 'main'

    // Merge the PR on GitHub
    const result = await githubService.mergePr(req.githubToken, owner, repo, prNumber, {
      merge_method: mergeMethod || 'squash',
    })

    // Pull locally to sync
    try {
      const { gitService } = await import('../services/git.service.js')
      const token = await accountService.resolveGitHubToken(req.userId!, projectId) || undefined
      await gitService.pull(project.localPath, 'origin', undefined, token)
    } catch { /* pull may fail if not on the base branch — that's ok */ }

    // Trigger deploy pipelines matching the base branch (fire-and-forget)
    try {
      const { deployService } = await import('../services/deploy.service.js')
      deployService.triggerMatchingPipelines(projectId, baseBranch, req.userId!).catch(() => {})
    } catch { /* deploy service may not exist */ }

    res.json({ success: true, data: { merged: result.merged, message: result.message, baseBranch } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/:projectId/prs - List open PRs for the project's repo */
router.get('/repos/:projectId/prs', requireGitHubToken, async (req: any, res) => {
  try {
    const projectId = param(req, 'projectId')
    const info = await getProjectRepoInfo(projectId, req.userId!)
    if (!info) {
      res.status(404).json({ success: false, error: 'Project not found or no GitHub repo linked' })
      return
    }

    const state = (req.query.state || 'open') as 'open' | 'closed' | 'all'
    const prs = await githubService.listPrs(req.githubToken, info.owner, info.repo, state)

    const data = prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user?.login || null,
      createdAt: pr.created_at,
      url: pr.html_url,
    }))

    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/:projectId/issues - List open issues for the project's repo */
router.get('/repos/:projectId/issues', requireGitHubToken, async (req: any, res) => {
  try {
    const projectId = param(req, 'projectId')
    const info = await getProjectRepoInfo(projectId, req.userId!)
    if (!info) {
      res.status(404).json({ success: false, error: 'Project not found or no GitHub repo linked' })
      return
    }

    const state = (req.query.state || 'open') as 'open' | 'closed' | 'all'
    const issues = await githubService.listIssues(req.githubToken, info.owner, info.repo, state)

    const data = issues.map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels?.map((l: any) => (typeof l === 'string' ? l : l.name)) || [],
      author: issue.user?.login || null,
      createdAt: issue.created_at,
      url: issue.html_url,
    }))

    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/github/repos/:projectId/issues - Create an issue for the project's repo */
router.post('/repos/:projectId/issues', requireGitHubToken, async (req: any, res) => {
  try {
    const projectId = param(req, 'projectId')
    const { title, body, labels } = req.body
    if (!title) {
      res.status(400).json({ success: false, error: 'title is required' })
      return
    }

    const info = await getProjectRepoInfo(projectId, req.userId!)
    if (!info) {
      res.status(404).json({ success: false, error: 'Project not found or no GitHub repo linked' })
      return
    }

    const issue = await githubService.createIssue(req.githubToken, info.owner, info.repo, {
      title,
      body,
      labels,
    })

    res.status(201).json({
      success: true,
      data: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/repos/:projectId/actions - Get CI/CD status (GitHub Actions) */
router.get('/repos/:projectId/actions', requireGitHubToken, async (req: any, res) => {
  try {
    const projectId = param(req, 'projectId')
    const info = await getProjectRepoInfo(projectId, req.userId!)
    if (!info) {
      res.status(404).json({ success: false, error: 'Project not found or no GitHub repo linked' })
      return
    }

    const runs = await githubService.listWorkflowRuns(req.githubToken, info.owner, info.repo)

    const data = runs.map((run: any) => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      url: run.html_url,
    }))

    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/github/orgs */
router.get('/orgs', requireGitHubToken, async (req: any, res) => {
  try {
    const orgs = await githubService.listOrgs(req.githubToken)
    res.json({ success: true, data: orgs })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
