import { eq, and, desc } from 'drizzle-orm'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import SftpClient from 'ssh2-sftp-client'
import { db, schema } from '../db/index.js'
import { encryptToken, decryptToken } from './auth.service.js'
import { broadcaster } from '../ws/broadcaster.js'
import { logger } from '../lib/logger.js'
import { projectService } from './project.service.js'

const execAsync = promisify(exec)
const log = logger.child('deploy')

export class DeployService {
  // ─── Pipeline CRUD ─────────────────────────────────────

  async listPipelines(projectId: string, userId: string) {
    return db
      .select({
        id: schema.deployPipelines.id,
        projectId: schema.deployPipelines.projectId,
        userId: schema.deployPipelines.userId,
        name: schema.deployPipelines.name,
        branchPattern: schema.deployPipelines.branchPattern,
        sftpHost: schema.deployPipelines.sftpHost,
        sftpPort: schema.deployPipelines.sftpPort,
        sftpUsername: schema.deployPipelines.sftpUsername,
        sftpRemotePath: schema.deployPipelines.sftpRemotePath,
        sftpSourcePath: schema.deployPipelines.sftpSourcePath,
        preDeployCommand: schema.deployPipelines.preDeployCommand,
        webhookUrl: schema.deployPipelines.webhookUrl,
        webhookType: schema.deployPipelines.webhookType,
        isEnabled: schema.deployPipelines.isEnabled,
        createdAt: schema.deployPipelines.createdAt,
        updatedAt: schema.deployPipelines.updatedAt,
      })
      .from(schema.deployPipelines)
      .where(and(
        eq(schema.deployPipelines.projectId, projectId),
        eq(schema.deployPipelines.userId, userId)
      ))
      .orderBy(schema.deployPipelines.createdAt)
  }

  async createPipeline(projectId: string, userId: string, input: {
    name: string
    branchPattern: string
    sftpHost: string
    sftpPort?: number
    sftpUsername: string
    sftpPassword?: string
    sftpPrivateKey?: string
    sftpRemotePath: string
    sftpSourcePath?: string
    preDeployCommand?: string
    webhookUrl?: string
    webhookType?: string
  }) {
    const [pipeline] = await db
      .insert(schema.deployPipelines)
      .values({
        projectId,
        userId,
        name: input.name,
        branchPattern: input.branchPattern,
        sftpHost: input.sftpHost,
        sftpPort: input.sftpPort || 22,
        sftpUsername: input.sftpUsername,
        sftpPasswordEncrypted: input.sftpPassword ? encryptToken(input.sftpPassword) : undefined,
        sftpPrivateKeyEncrypted: input.sftpPrivateKey ? encryptToken(input.sftpPrivateKey) : undefined,
        sftpRemotePath: input.sftpRemotePath,
        sftpSourcePath: input.sftpSourcePath || '.',
        preDeployCommand: input.preDeployCommand,
        webhookUrl: input.webhookUrl,
        webhookType: input.webhookType || 'custom',
      })
      .returning()

    const { sftpPasswordEncrypted, sftpPrivateKeyEncrypted, ...safe } = pipeline
    return safe
  }

  async updatePipeline(pipelineId: string, userId: string, input: Record<string, unknown>) {
    // Verify ownership
    const [existing] = await db.select().from(schema.deployPipelines)
      .where(and(eq(schema.deployPipelines.id, pipelineId), eq(schema.deployPipelines.userId, userId)))
      .limit(1)
    if (!existing) return null

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    const fields = ['name', 'branchPattern', 'sftpHost', 'sftpPort', 'sftpUsername', 'sftpRemotePath', 'sftpSourcePath', 'preDeployCommand', 'webhookUrl', 'webhookType', 'isEnabled'] as const
    for (const f of fields) {
      if (input[f] !== undefined) updates[f] = input[f]
    }
    if (input.sftpPassword) updates.sftpPasswordEncrypted = encryptToken(input.sftpPassword as string)
    if (input.sftpPrivateKey) updates.sftpPrivateKeyEncrypted = encryptToken(input.sftpPrivateKey as string)

    const [updated] = await db.update(schema.deployPipelines).set(updates)
      .where(eq(schema.deployPipelines.id, pipelineId)).returning()
    const { sftpPasswordEncrypted, sftpPrivateKeyEncrypted, ...safe } = updated
    return safe
  }

  async deletePipeline(pipelineId: string, userId: string) {
    const [existing] = await db.select().from(schema.deployPipelines)
      .where(and(eq(schema.deployPipelines.id, pipelineId), eq(schema.deployPipelines.userId, userId)))
      .limit(1)
    if (!existing) return false
    await db.delete(schema.deployRuns).where(eq(schema.deployRuns.pipelineId, pipelineId))
    await db.delete(schema.deployPipelines).where(eq(schema.deployPipelines.id, pipelineId))
    return true
  }

  // ─── Deploy Execution ──────────────────────────────────

  async triggerMatchingPipelines(projectId: string, branch: string, userId: string) {
    const pipelines = await db.select().from(schema.deployPipelines)
      .where(and(
        eq(schema.deployPipelines.projectId, projectId),
        eq(schema.deployPipelines.userId, userId),
        eq(schema.deployPipelines.isEnabled, true)
      ))

    for (const pipeline of pipelines) {
      if (this.matchBranch(branch, pipeline.branchPattern)) {
        log.info('Pipeline matched', { pipeline: pipeline.name, branch })
        // Fire and forget - don't block the push
        this.executePipeline(pipeline, branch, userId).catch((err) => {
          log.error('Pipeline execution failed', { pipeline: pipeline.name, error: (err as Error).message })
        })
      }
    }
  }

  private matchBranch(branch: string, pattern: string): boolean {
    if (pattern === '*') return true
    if (pattern === branch) return true
    // Simple wildcard: 'release/*' matches 'release/v1.0'
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      return regex.test(branch)
    }
    return false
  }

  private async executePipeline(pipeline: typeof schema.deployPipelines.$inferSelect, branch: string, userId: string) {
    // Global timeout: 5 minutes max for any deploy
    const timeoutMs = 300_000
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Deploy timed out after 5 minutes')), timeoutMs)
    )

    try {
      await Promise.race([
        this._executePipeline(pipeline, branch, userId),
        timeoutPromise,
      ])
    } catch (err) {
      // If timeout, mark any running runs as failed
      await db.update(schema.deployRuns).set({
        status: 'failed',
        error: (err as Error).message,
        completedAt: new Date(),
        durationMs: timeoutMs,
      }).where(and(
        eq(schema.deployRuns.pipelineId, pipeline.id),
        eq(schema.deployRuns.status, 'running')
      ))

      broadcaster.toUser(userId, 'deploy:status', {
        runId: '',
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        status: 'failed',
        branch,
        error: (err as Error).message,
      })
    }
  }

  private async _executePipeline(pipeline: typeof schema.deployPipelines.$inferSelect, branch: string, userId: string) {
    const startTime = Date.now()

    // Create run record
    const [run] = await db.insert(schema.deployRuns).values({
      pipelineId: pipeline.id,
      projectId: pipeline.projectId,
      userId,
      branch,
      status: 'running',
      startedAt: new Date(),
    }).returning()

    // Notify via WS
    broadcaster.toUser(userId, 'deploy:status', {
      runId: run.id,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      status: 'running',
      branch,
    })

    try {
      // Get project path
      const project = await projectService.getById(pipeline.projectId, userId)
      if (!project) throw new Error('Project not found')

      // Get commit hash
      const { execSync } = await import('child_process')
      let commitHash = ''
      try {
        commitHash = execSync('git rev-parse --short HEAD', { cwd: project.localPath }).toString().trim()
      } catch { /* not a git repo or no commits */ }

      // Run pre-deploy command if configured
      if (pipeline.preDeployCommand) {
        log.info('Running pre-deploy command', { command: pipeline.preDeployCommand })
        await execAsync(pipeline.preDeployCommand, { cwd: project.localPath, timeout: 300_000 })
      }

      // SFTP upload
      const sourcePath = path.resolve(project.localPath, pipeline.sftpSourcePath)
      const filesUploaded = await this.sftpUpload(pipeline, sourcePath)

      const durationMs = Date.now() - startTime

      // Update run as success
      await db.update(schema.deployRuns).set({
        status: 'success',
        filesUploaded,
        commitHash,
        completedAt: new Date(),
        durationMs,
      }).where(eq(schema.deployRuns.id, run.id))

      // Notify via WS
      broadcaster.toUser(userId, 'deploy:status', {
        runId: run.id,
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        status: 'success',
        branch,
        filesUploaded,
        durationMs,
      })

      // Send webhook
      if (pipeline.webhookUrl) {
        const webhookStatus = await this.sendWebhook(pipeline, {
          status: 'success',
          branch,
          commitHash,
          filesUploaded,
          durationMs,
          projectName: project.name,
        })
        await db.update(schema.deployRuns).set({ webhookStatus }).where(eq(schema.deployRuns.id, run.id))
      }

      log.info('Deploy success', { pipeline: pipeline.name, files: filesUploaded, duration: durationMs })
    } catch (err) {
      const durationMs = Date.now() - startTime
      const errorMsg = (err as Error).message

      await db.update(schema.deployRuns).set({
        status: 'failed',
        error: errorMsg,
        completedAt: new Date(),
        durationMs,
      }).where(eq(schema.deployRuns.id, run.id))

      broadcaster.toUser(userId, 'deploy:status', {
        runId: run.id,
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        status: 'failed',
        branch,
        error: errorMsg,
      })

      // Send failure webhook
      if (pipeline.webhookUrl) {
        const project = await projectService.getById(pipeline.projectId, userId)
        await this.sendWebhook(pipeline, {
          status: 'failed',
          branch,
          error: errorMsg,
          durationMs,
          projectName: project?.name || 'Unknown',
        })
      }

      log.error('Deploy failed', { pipeline: pipeline.name, error: errorMsg })
    }
  }

  private async sftpUpload(pipeline: typeof schema.deployPipelines.$inferSelect, sourcePath: string): Promise<number> {
    const sftp = new SftpClient()
    let filesUploaded = 0

    try {
      let decryptedPassword: string | undefined
      let decryptedKey: string | undefined

      if (pipeline.sftpPasswordEncrypted) {
        decryptedPassword = decryptToken(pipeline.sftpPasswordEncrypted)
        if (decryptedPassword === 'CHANGE_ME') {
          throw new Error('SFTP password not configured. Edit the pipeline in Project Settings to set the real password.')
        }
      }
      if (pipeline.sftpPrivateKeyEncrypted) {
        decryptedKey = decryptToken(pipeline.sftpPrivateKeyEncrypted)
      }

      if (!decryptedPassword && !decryptedKey) {
        throw new Error('No SFTP credentials configured. Set password or private key in Project Settings.')
      }

      const connectConfig: SftpClient.ConnectOptions = {
        host: pipeline.sftpHost,
        port: pipeline.sftpPort,
        username: pipeline.sftpUsername,
        readyTimeout: 15_000, // 15s connection timeout
        retries: 1,
      }

      if (decryptedPassword) connectConfig.password = decryptedPassword
      if (decryptedKey) connectConfig.privateKey = decryptedKey

      log.info('SFTP connecting', { host: pipeline.sftpHost, port: pipeline.sftpPort, user: pipeline.sftpUsername })

      await sftp.connect(connectConfig)
      log.info('SFTP connected', { host: pipeline.sftpHost })

      // Determine the remote destination:
      // If sourcePath is a subdirectory (e.g. "cobblespawners"), preserve the folder name
      // remotePath = "./config/" + "cobblespawners" = "./config/cobblespawners"
      const sourceBaseName = path.basename(sourcePath)
      const projectLocalPath = path.dirname(sourcePath)
      const isSubfolder = pipeline.sftpSourcePath !== '.' && pipeline.sftpSourcePath !== './'

      let remoteDest = pipeline.sftpRemotePath
      if (isSubfolder) {
        // Preserve the source folder name in the remote path
        remoteDest = path.posix.join(pipeline.sftpRemotePath, sourceBaseName)
      }

      // Ensure remote directory exists
      try { await sftp.mkdir(remoteDest, true) } catch { /* may already exist */ }

      // Check if source is a file or directory
      const fsStat = await import('fs/promises')
      const stat = await fsStat.stat(sourcePath)

      if (stat.isFile()) {
        // Single file upload
        const remoteFile = path.posix.join(pipeline.sftpRemotePath, path.basename(sourcePath))
        await sftp.put(sourcePath, remoteFile)
        filesUploaded = 1
      } else {
        // Directory: upload file by file (no compression)
        filesUploaded = await this.uploadDir(sftp, sourcePath, remoteDest)
      }
    } finally {
      await sftp.end()
    }

    return filesUploaded
  }

  private async uploadDir(sftp: SftpClient, localDir: string, remoteDir: string): Promise<number> {
    // Collect all files first, then upload in parallel batches
    const filePairs = await this.collectFiles(localDir, remoteDir)
    if (filePairs.length === 0) return 0

    // Create all remote directories first (sequential, fast)
    const dirs = [...new Set(filePairs.map((f) => path.posix.dirname(f.remote)))]
    for (const dir of dirs) {
      try { await sftp.mkdir(dir, true) } catch { /* exists */ }
    }

    // Upload files in parallel batches of 10
    const BATCH_SIZE = 10
    let count = 0
    for (let i = 0; i < filePairs.length; i += BATCH_SIZE) {
      const batch = filePairs.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async ({ local, remote }) => {
        await sftp.put(local, remote)
        count++
      }))
    }

    return count
  }

  private async collectFiles(localDir: string, remoteDir: string): Promise<{ local: string; remote: string }[]> {
    const fs = await import('fs/promises')
    const SKIP = new Set(['.git', 'node_modules', '.next', '__pycache__', '.venv', '.env', '.DS_Store'])
    const results: { local: string; remote: string }[] = []

    const entries = await fs.readdir(localDir, { withFileTypes: true })
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue
      const localPath = path.join(localDir, entry.name)
      const remotePath = path.posix.join(remoteDir, entry.name)

      if (entry.isDirectory()) {
        const sub = await this.collectFiles(localPath, remotePath)
        results.push(...sub)
      } else {
        results.push({ local: localPath, remote: remotePath })
      }
    }

    return results
  }

  // ─── Webhooks ──────────────────────────────────────────

  private async sendWebhook(pipeline: typeof schema.deployPipelines.$inferSelect, data: {
    status: string
    branch: string
    commitHash?: string
    filesUploaded?: number
    durationMs?: number
    error?: string
    projectName: string
  }): Promise<number> {
    try {
      let body: string
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      if (pipeline.webhookType === 'discord') {
        const color = data.status === 'success' ? 0x22c55e : 0xef4444
        const emoji = data.status === 'success' ? ':white_check_mark:' : ':x:'
        body = JSON.stringify({
          embeds: [{
            title: `${emoji} Deploy ${data.status.toUpperCase()}`,
            description: `**${data.projectName}** → \`${pipeline.name}\``,
            color,
            fields: [
              { name: 'Branch', value: `\`${data.branch}\``, inline: true },
              ...(data.commitHash ? [{ name: 'Commit', value: `\`${data.commitHash}\``, inline: true }] : []),
              ...(data.filesUploaded !== undefined ? [{ name: 'Files', value: `${data.filesUploaded}`, inline: true }] : []),
              ...(data.durationMs !== undefined ? [{ name: 'Duration', value: `${(data.durationMs / 1000).toFixed(1)}s`, inline: true }] : []),
              ...(data.error ? [{ name: 'Error', value: `\`\`\`${data.error.slice(0, 200)}\`\`\`` }] : []),
              { name: 'Server', value: `\`${pipeline.sftpHost}:${pipeline.sftpRemotePath}\``, inline: false },
            ],
            timestamp: new Date().toISOString(),
          }],
        })
      } else if (pipeline.webhookType === 'slack') {
        const emoji = data.status === 'success' ? ':white_check_mark:' : ':x:'
        body = JSON.stringify({
          text: `${emoji} Deploy ${data.status}: *${data.projectName}* → \`${pipeline.name}\``,
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: `${emoji} *Deploy ${data.status.toUpperCase()}*\n*${data.projectName}* → \`${pipeline.name}\`` } },
            { type: 'section', fields: [
              { type: 'mrkdwn', text: `*Branch:* \`${data.branch}\`` },
              ...(data.commitHash ? [{ type: 'mrkdwn', text: `*Commit:* \`${data.commitHash}\`` }] : []),
              ...(data.filesUploaded !== undefined ? [{ type: 'mrkdwn', text: `*Files:* ${data.filesUploaded}` }] : []),
              ...(data.durationMs !== undefined ? [{ type: 'mrkdwn', text: `*Duration:* ${(data.durationMs / 1000).toFixed(1)}s` }] : []),
            ]},
            ...(data.error ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Error:*\n\`\`\`${data.error.slice(0, 500)}\`\`\`` } }] : []),
          ],
        })
      } else {
        // Custom webhook - raw JSON
        body = JSON.stringify({
          event: 'deploy',
          ...data,
          pipeline: pipeline.name,
          server: `${pipeline.sftpHost}:${pipeline.sftpRemotePath}`,
          timestamp: new Date().toISOString(),
        })
      }

      const res = await fetch(pipeline.webhookUrl!, { method: 'POST', headers, body })
      return res.status
    } catch (err) {
      log.error('Webhook delivery failed', { error: (err as Error).message })
      return 0
    }
  }

  // ─── Run History ───────────────────────────────────────

  async getRunHistory(projectId: string, userId: string, limit = 20) {
    return db
      .select({
        id: schema.deployRuns.id,
        pipelineId: schema.deployRuns.pipelineId,
        projectId: schema.deployRuns.projectId,
        userId: schema.deployRuns.userId,
        branch: schema.deployRuns.branch,
        commitHash: schema.deployRuns.commitHash,
        status: schema.deployRuns.status,
        filesUploaded: schema.deployRuns.filesUploaded,
        error: schema.deployRuns.error,
        webhookStatus: schema.deployRuns.webhookStatus,
        startedAt: schema.deployRuns.startedAt,
        completedAt: schema.deployRuns.completedAt,
        durationMs: schema.deployRuns.durationMs,
        createdAt: schema.deployRuns.createdAt,
        pipelineName: schema.deployPipelines.name,
      })
      .from(schema.deployRuns)
      .leftJoin(schema.deployPipelines, eq(schema.deployRuns.pipelineId, schema.deployPipelines.id))
      .where(and(
        eq(schema.deployRuns.projectId, projectId),
        eq(schema.deployRuns.userId, userId)
      ))
      .orderBy(desc(schema.deployRuns.createdAt))
      .limit(limit)
  }

  async manualTrigger(pipelineId: string, userId: string) {
    const [pipeline] = await db.select().from(schema.deployPipelines)
      .where(and(eq(schema.deployPipelines.id, pipelineId), eq(schema.deployPipelines.userId, userId)))
      .limit(1)
    if (!pipeline) throw new Error('Pipeline not found')

    const project = await projectService.getById(pipeline.projectId, userId)
    if (!project) throw new Error('Project not found')

    // Get current branch
    const { execSync } = await import('child_process')
    let branch = 'main'
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: project.localPath }).toString().trim()
    } catch { /* fallback to main */ }

    // Execute async
    this.executePipeline(pipeline, branch, userId).catch((err) => {
      log.error('Manual trigger failed', { error: (err as Error).message })
    })

    return { branch }
  }
}

export const deployService = new DeployService()
