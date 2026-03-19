import simpleGit, { type SimpleGit } from 'simple-git'
import path from 'path'
import fs from 'fs/promises'

export interface Snapshot {
  id: string
  name: string
  description: string
  createdAt: string
  commitHash: string
}

export interface SnapshotDiffFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

export interface SnapshotDiff {
  files: SnapshotDiffFile[]
  summary: string
}

export class SnapshotService {
  private getGit(projectPath: string): SimpleGit {
    return simpleGit(projectPath)
  }

  /** Ensure the project directory has its own .git */
  private async ensureGitRepo(projectPath: string): Promise<void> {
    const gitDir = path.join(projectPath, '.git')
    try {
      await fs.access(gitDir)
    } catch {
      await simpleGit(projectPath).init()
    }
  }

  /** Slugify a name for use in a git tag */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
  }

  /** Parse snapshot metadata from a tag name and its annotation */
  private parseTag(tagName: string, date: string, commitHash: string, message: string): Snapshot {
    // Tag format: axy-snapshot/{timestamp}-{name-slug}
    const suffix = tagName.replace('axy-snapshot/', '')
    const dashIndex = suffix.indexOf('-')
    const name = dashIndex >= 0 ? suffix.slice(dashIndex + 1).replace(/-/g, ' ') : suffix

    // The annotation message may contain a description after the first line
    const lines = message.split('\n')
    const description = lines.slice(1).join('\n').trim()

    return {
      id: tagName,
      name: lines[0] || name,
      description,
      createdAt: date,
      commitHash,
    }
  }

  async create(projectPath: string, name: string, description?: string): Promise<Snapshot> {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)

    // Stage all files
    await git.add('-A')

    // Create a commit with snapshot prefix
    const commitMessage = `[snapshot] ${name}`
    await git.commit(commitMessage, undefined, { '--allow-empty': null })

    // Get the commit hash
    const log = await git.log({ maxCount: 1 })
    const commitHash = log.latest?.hash || ''

    // Create the tag name
    const timestamp = Date.now()
    const slug = this.slugify(name)
    const tagName = `axy-snapshot/${timestamp}-${slug}`

    // Build the tag annotation message
    const tagMessage = description ? `${name}\n${description}` : name

    // Create annotated tag
    await git.tag(['-a', tagName, '-m', tagMessage])

    return {
      id: tagName,
      name,
      description: description || '',
      createdAt: new Date().toISOString(),
      commitHash,
    }
  }

  async list(projectPath: string): Promise<Snapshot[]> {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)

    // Get all tags matching our prefix
    const tagResult = await git.tag(['-l', 'axy-snapshot/*'])
    const tagNames = tagResult
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)

    if (tagNames.length === 0) return []

    // Fetch all tag data in parallel instead of sequential N+1
    const snapshotResults = await Promise.all(
      tagNames.map(async (tagName) => {
        try {
          const [message, commitHash] = await Promise.all([
            git.raw(['tag', '-l', '--format=%(contents)', tagName]),
            git.raw(['rev-list', '-n', '1', tagName]),
          ])
          const date = await git.raw(['log', '-1', '--format=%aI', commitHash.trim()])
          return this.parseTag(tagName, date.trim(), commitHash.trim(), message.trim())
        } catch {
          return null // Skip tags we can't parse
        }
      })
    )
    const snapshots = snapshotResults.filter((s): s is Snapshot => s !== null)

    // Sort by date descending (newest first)
    snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return snapshots
  }

  async restore(projectPath: string, snapshotId: string): Promise<string> {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)

    // Stash current changes if any
    const status = await git.status()
    const hasChanges =
      status.modified.length > 0 ||
      status.staged.length > 0 ||
      status.not_added.length > 0

    if (hasChanges) {
      await git.stash(['push', '-m', 'auto-stash before snapshot restore'])
    }

    // Create a new branch from the snapshot tag
    const timestamp = Date.now()
    const branchName = `restore-${timestamp}`

    await git.checkout(snapshotId)
    await git.checkoutBranch(branchName, snapshotId)

    return branchName
  }

  async delete(projectPath: string, snapshotId: string): Promise<void> {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)
    await git.tag(['-d', snapshotId])
  }

  async diff(projectPath: string, snapshotId: string): Promise<SnapshotDiff> {
    await this.ensureGitRepo(projectPath)
    const git = this.getGit(projectPath)

    // Get diff stat summary
    const summary = await git.raw(['diff', `${snapshotId}..HEAD`, '--stat'])

    // Get list of changed files with status
    const nameStatus = await git.raw(['diff', `${snapshotId}..HEAD`, '--name-status'])

    const files: SnapshotDiffFile[] = nameStatus
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [statusCode, ...pathParts] = line.split('\t')
        const filePath = pathParts.join('\t')
        let status: SnapshotDiffFile['status'] = 'modified'
        if (statusCode.startsWith('A')) status = 'added'
        else if (statusCode.startsWith('D')) status = 'deleted'
        else if (statusCode.startsWith('R')) status = 'renamed'
        else if (statusCode.startsWith('M')) status = 'modified'
        return { path: filePath, status }
      })

    return { files, summary: summary.trim() }
  }
}

export const snapshotService = new SnapshotService()
