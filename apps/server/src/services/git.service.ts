import simpleGit, { type SimpleGit } from 'simple-git'
import path from 'path'
import fs from 'fs/promises'
import type { GitStatus, GitLogEntry } from '@axy/shared'

export class GitService {
  private getGit(projectPath: string): SimpleGit {
    return simpleGit(projectPath)
  }

  /** Ensure the project directory has its own .git (not inherited from parent) */
  private async ensureGitRepo(projectPath: string): Promise<void> {
    const gitDir = path.join(projectPath, '.git')
    try {
      await fs.access(gitDir)
    } catch {
      // No .git in project dir - init one so we don't use a parent repo
      await simpleGit(projectPath).init()
    }
  }

  async clone(repoUrl: string, targetPath: string, branch?: string, token?: string): Promise<void> {
    let cloneUrl = repoUrl
    // Inject token for authenticated clone (works for private repos)
    if (token && cloneUrl.startsWith('https://')) {
      cloneUrl = cloneUrl.replace('https://', `https://x-access-token:${token}@`)
    }
    const options = branch ? ['--branch', branch] : []
    await simpleGit().clone(cloneUrl, targetPath, options)
  }

  async init(projectPath: string): Promise<void> {
    await this.getGit(projectPath).init()
  }

  async status(projectPath: string): Promise<GitStatus> {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)

    const status = await git.status()

    // Build staged files with proper status detection
    const staged: GitStatus['staged'] = []
    for (const f of status.created) {
      staged.push({ path: f, status: 'added' })
    }
    for (const f of status.staged) {
      if (!status.created.includes(f)) {
        staged.push({ path: f, status: 'modified' })
      }
    }
    for (const f of status.deleted) {
      if (status.staged.includes(f) || !status.modified.includes(f)) {
        staged.push({ path: f, status: 'deleted' })
      }
    }

    // Build unstaged files with proper status detection
    const unstaged: GitStatus['unstaged'] = []
    for (const f of status.modified) {
      if (!status.staged.includes(f)) {
        unstaged.push({ path: f, status: 'modified' })
      }
    }
    for (const f of status.deleted) {
      if (!status.staged.includes(f)) {
        unstaged.push({ path: f, status: 'deleted' })
      }
    }
    for (const f of status.renamed) {
      unstaged.push({ path: (f as any).to || f, status: 'renamed' })
    }

    // Check if remote origin exists
    let hasRemote = false
    const remotes = await git.getRemotes()
    hasRemote = remotes.some((r) => r.name === 'origin')

    // Calculate ahead/behind vs origin (more reliable than simple-git's tracking)
    let ahead = status.ahead
    let behind = status.behind
    const branch = status.current || 'unknown'
    if (hasRemote) {
      try {
        const remoteBranch = `origin/${branch}`
        await git.raw(['rev-parse', '--verify', remoteBranch])
        const aheadStr = await git.raw(['rev-list', '--count', `${remoteBranch}..HEAD`])
        ahead = parseInt(aheadStr.trim(), 10) || 0
        const behindStr = await git.raw(['rev-list', '--count', `HEAD..${remoteBranch}`])
        behind = parseInt(behindStr.trim(), 10) || 0
      } catch {
        // Remote branch doesn't exist yet
      }
    }

    return {
      branch,
      ahead,
      behind,
      staged,
      unstaged,
      untracked: status.not_added,
      hasRemote,
    }
  }

  async fetch(projectPath: string) {
    await this.ensureGitRepo(projectPath)
    await this.getGit(projectPath).fetch()
  }

  async branches(projectPath: string) {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    const branches = await git.branch()
    return {
      current: branches.current,
      all: branches.all,
      branches: branches.branches,
    }
  }

  async checkout(projectPath: string, branch: string): Promise<{ stashApplied: boolean; conflicts: boolean }> {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)

    // Check if working tree is dirty
    const st = await git.status()
    const isDirty = st.modified.length > 0 || st.staged.length > 0
      || st.not_added.length > 0 || st.deleted.length > 0 || st.created.length > 0

    let didStash = false
    let conflicts = false

    if (isDirty) {
      // Stash everything before switching
      const result = await git.raw(['stash', 'push', '--include-untracked', '-m', `axy-switch-to-${branch}`])
      didStash = !result.includes('No local changes')
    }

    // Switch branch
    await git.checkout(branch)

    // Pop stash on the new branch to restore changes
    if (didStash) {
      try {
        await git.raw(['stash', 'pop'])
      } catch {
        // Conflicts during pop — stash stays in list, partial changes applied
        conflicts = true
      }
    }

    return { stashApplied: didStash, conflicts }
  }

  async merge(projectPath: string, fromBranch: string) {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    await git.merge([fromBranch])
  }

  async commit(projectPath: string, message: string, files?: string[]) {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    if (files && files.length > 0) {
      await git.add(files)
    } else {
      await git.add('.')
    }
    return git.commit(message)
  }

  async push(projectPath: string, remote = 'origin', branch?: string, token?: string) {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    const currentBranch = branch || (await git.status()).current || 'main'

    if (token) {
      // Set remote URL with token for authenticated push
      await this.setAuthenticatedRemote(git, remote, token)
    }

    await git.push(remote, currentBranch, ['--set-upstream'])
  }

  async pull(projectPath: string, remote = 'origin', branch?: string, token?: string) {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    const currentBranch = branch || (await git.status()).current || 'main'

    if (token) {
      await this.setAuthenticatedRemote(git, remote, token)
    }

    await git.pull(remote, currentBranch)
  }

  async discardFile(projectPath: string, filePath: string) {
    await this.ensureGitRepo(projectPath)
    await this.getGit(projectPath).checkout(['--', filePath])
  }

  async discardAll(projectPath: string) {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    await git.checkout(['--', '.'])
    await git.clean('f', ['-d']) // remove untracked files
  }

  async linkRemote(projectPath: string, repoUrl: string) {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    const remotes = await git.getRemotes()
    if (remotes.some((r) => r.name === 'origin')) {
      await git.remote(['set-url', 'origin', repoUrl])
    } else {
      await git.addRemote('origin', repoUrl)
    }
  }

  /** Temporarily inject token into remote URL for auth */
  private async setAuthenticatedRemote(git: SimpleGit, remote: string, token: string) {
    try {
      const remotes = await git.getRemotes(true)
      const origin = remotes.find((r) => r.name === remote)
      if (origin?.refs?.push) {
        const url = origin.refs.push
        if (url.startsWith('https://') && !url.includes('@')) {
          const authUrl = url.replace('https://', `https://x-access-token:${token}@`)
          await git.remote(['set-url', remote, authUrl])
        }
      }
    } catch {
      // If remote doesn't exist, push will fail with a clear error
    }
  }

  async createBranch(projectPath: string, branchName: string) {
    await this.ensureGitRepo(projectPath)
    await this.getGit(projectPath).checkoutLocalBranch(branchName)
  }

  async log(projectPath: string, maxCount = 50): Promise<GitLogEntry[]> {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    try {
      const log = await git.log({ maxCount })
      return log.all.map(entry => ({
        hash: entry.hash,
        message: entry.message,
        author: entry.author_name,
        date: entry.date,
      }))
    } catch {
      // No commits yet or not a valid git repo
      return []
    }
  }

  async diff(projectPath: string, staged = false) {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    return staged ? git.diff(['--staged']) : git.diff()
  }

  async stage(projectPath: string, files: string[]) {
    await this.ensureGitRepo(projectPath)
    await this.getGit(projectPath).add(files)
  }

  async unstage(projectPath: string, files: string[]) {
    await this.ensureGitRepo(projectPath)
    await this.getGit(projectPath).reset(['HEAD', '--', ...files])
  }
}

export const gitService = new GitService()
