import { eq, and, desc, lte } from 'drizzle-orm'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import { db, schema } from '../db/index.js'
import { broadcaster } from '../ws/broadcaster.js'
import { projectService } from './project.service.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

const log = logger.child('task')

// Active task processes
const activeTaskProcesses = new Map<string, ChildProcess>()

export interface CreateTaskInput {
  sessionId?: string
  userId: string
  projectId: string
  type?: string
  title: string
  description?: string
  command?: string
  metadataJson?: Record<string, unknown>
}

export interface ScheduleTaskInput {
  userId: string
  projectId: string
  title: string
  description?: string
  command?: string
  cronExpression: string
}

// ─── Simple cron parser ─────────────────────────────────
// Supports: * (every), N (specific), */N (every N units)
// Format: minute hour dayOfMonth month dayOfWeek

function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') {
    const values: number[] = []
    for (let i = min; i <= max; i++) values.push(i)
    return values
  }

  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10)
    if (isNaN(step) || step <= 0) return []
    const values: number[] = []
    for (let i = min; i <= max; i += step) values.push(i)
    return values
  }

  const num = parseInt(field, 10)
  if (!isNaN(num) && num >= min && num <= max) return [num]

  return []
}

export function getNextCronRun(cronExpression: string, after: Date): Date {
  const parts = cronExpression.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error('Cron expression must have exactly 5 fields')

  const minutes = parseCronField(parts[0], 0, 59)
  const hours = parseCronField(parts[1], 0, 23)
  const daysOfMonth = parseCronField(parts[2], 1, 31)
  const months = parseCronField(parts[3], 1, 12)
  const daysOfWeek = parseCronField(parts[4], 0, 6) // 0=Sunday

  if (!minutes.length || !hours.length || !daysOfMonth.length || !months.length || !daysOfWeek.length) {
    throw new Error('Invalid cron expression: empty field')
  }

  // Start searching from one minute after the "after" date
  const candidate = new Date(after.getTime())
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)

  // Search up to 366 days ahead to find next match
  const maxAttempts = 366 * 24 * 60 // one year of minutes
  for (let i = 0; i < maxAttempts; i++) {
    const month = candidate.getMonth() + 1 // 1-12
    const dayOfMonth = candidate.getDate()
    const dayOfWeek = candidate.getDay() // 0=Sunday
    const hour = candidate.getHours()
    const minute = candidate.getMinutes()

    if (
      months.includes(month) &&
      daysOfMonth.includes(dayOfMonth) &&
      daysOfWeek.includes(dayOfWeek) &&
      hours.includes(hour) &&
      minutes.includes(minute)
    ) {
      return candidate
    }

    candidate.setMinutes(candidate.getMinutes() + 1)
  }

  throw new Error('Could not find next cron run within one year')
}

export class TaskService {
  async list(projectId: string, userId: string) {
    return db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.projectId, projectId),
          eq(schema.tasks.userId, userId)
        )
      )
      .orderBy(desc(schema.tasks.createdAt))
      .limit(50)
  }

  async listBySession(sessionId: string, userId: string) {
    return db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.sessionId, sessionId),
          eq(schema.tasks.userId, userId)
        )
      )
      .orderBy(desc(schema.tasks.createdAt))
  }

  async getById(taskId: string, userId: string) {
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.id, taskId),
          eq(schema.tasks.userId, userId)
        )
      )
      .limit(1)
    return task || null
  }

  async create(input: CreateTaskInput) {
    const [task] = await db
      .insert(schema.tasks)
      .values({
        sessionId: input.sessionId,
        userId: input.userId,
        projectId: input.projectId,
        type: input.type || 'background_task',
        title: input.title,
        description: input.description,
        command: input.command,
        metadataJson: input.metadataJson || {},
      })
      .returning()

    // Broadcast task creation
    if (input.sessionId) {
      broadcaster.toSession(input.sessionId, 'task:created' as any, {
        task,
      })
    }

    // Auto-execute background tasks
    if ((input.type || 'background_task') === 'background_task') {
      this.executeTask(task).catch((err) => {
        log.error('Failed to execute task', { taskId: task.id, error: String(err) })
      })
    }

    return task
  }

  async updateStatus(
    taskId: string,
    userId: string,
    status: string,
    extra?: { result?: string; error?: string; progress?: number }
  ) {
    const now = new Date()
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
    }

    if (status === 'running') {
      updates.startedAt = now
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = now
      // Calculate duration
      const task = await this.getById(taskId, userId)
      if (task?.startedAt) {
        updates.durationMs = now.getTime() - new Date(task.startedAt).getTime()
      }
    }

    if (extra?.result !== undefined) updates.result = extra.result
    if (extra?.error !== undefined) updates.error = extra.error
    if (extra?.progress !== undefined) updates.progress = extra.progress

    const [updated] = await db
      .update(schema.tasks)
      .set(updates)
      .where(
        and(
          eq(schema.tasks.id, taskId),
          eq(schema.tasks.userId, userId)
        )
      )
      .returning()

    // Broadcast task update
    if (updated?.sessionId) {
      broadcaster.toSession(updated.sessionId, 'task:updated' as any, {
        task: updated,
      })
    }

    return updated || null
  }

  async updateProgress(taskId: string, userId: string, progress: number) {
    return this.updateStatus(taskId, userId, 'running', { progress })
  }

  async cancel(taskId: string, userId: string) {
    return this.updateStatus(taskId, userId, 'cancelled')
  }

  async delete(taskId: string, userId: string) {
    await db
      .delete(schema.tasks)
      .where(
        and(
          eq(schema.tasks.id, taskId),
          eq(schema.tasks.userId, userId)
        )
      )
    return true
  }

  /** Execute a background task using Claude CLI */
  private async executeTask(task: {
    id: string
    userId: string
    projectId: string
    title: string
    description?: string | null
    sessionId?: string | null
  }): Promise<void> {
    // Get project path
    const project = await projectService.getById(task.projectId, task.userId)
    if (!project) {
      await this.updateStatus(task.id, task.userId, 'failed', { error: 'Project not found' })
      return
    }

    // Mark as running
    await this.updateStatus(task.id, task.userId, 'running')

    const prompt = task.description
      ? `Task: ${task.title}\n\n${task.description}`
      : task.title

    const args: string[] = [
      '--print',
      '--output-format', 'text',
      '--model', 'claude-sonnet-4-20250514',
    ]

    // Use project permission mode
    if (project.permissionMode === 'bypass') {
      args.push('--permission-mode', 'bypassPermissions')
    } else {
      args.push('--permission-mode', 'plan')
    }

    args.push(prompt)

    const cwd = path.resolve(project.localPath)

    // Build clean env
    const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: '1' }
    delete env.CLAUDECODE
    delete env.CLAUDE_CODE_ENTRYPOINT
    delete env.NODE_CHANNEL_FD

    log.info('Executing task', { taskId: task.id, title: task.title })

    try {
      const child = spawn(config.claudePath, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      child.stdin?.end()
      activeTaskProcesses.set(task.id, child)

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          activeTaskProcesses.delete(task.id)
          if (code === 0 || stdout) {
            resolve()
          } else {
            reject(new Error(stderr || `Process exited with code ${code}`))
          }
        })
        child.on('error', (err) => {
          activeTaskProcesses.delete(task.id)
          reject(err)
        })
      })

      // Task completed
      await this.updateStatus(task.id, task.userId, 'completed', {
        result: stdout.trim() || '(completed)',
      })
      log.info('Task completed', { taskId: task.id })


    } catch (err) {
      activeTaskProcesses.delete(task.id)
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      await this.updateStatus(task.id, task.userId, 'failed', { error: errorMsg })
      log.error('Task failed', { taskId: task.id, error: errorMsg })

    }
  }

  /** Cancel a running task process */
  cancelProcess(taskId: string): boolean {
    const child = activeTaskProcesses.get(taskId)
    if (child) {
      child.kill('SIGTERM')
      activeTaskProcesses.delete(taskId)
      return true
    }
    return false
  }

  /** Create a scheduled/recurring task with a cron expression */
  async scheduleTask(input: ScheduleTaskInput) {
    const nextRunAt = getNextCronRun(input.cronExpression, new Date())

    const [task] = await db
      .insert(schema.tasks)
      .values({
        userId: input.userId,
        projectId: input.projectId,
        type: 'background_task',
        status: 'scheduled',
        title: input.title,
        description: input.description,
        command: input.command,
        cronExpression: input.cronExpression,
        isRecurring: true,
        nextRunAt,
        metadataJson: {},
      })
      .returning()

    log.info('Scheduled recurring task', { taskId: task.id, title: task.title, cron: input.cronExpression, nextRunAt: nextRunAt.toISOString() })
    return task
  }

  /** Start the scheduler that checks for due recurring tasks every 60 seconds */
  startScheduler() {
    log.info('Scheduler started (checking every 60s)')

    setInterval(async () => {
      try {
        await this.runScheduledTasks()
      } catch (err) {
        log.error('Scheduler error', { error: String(err) })
      }
    }, 60_000)
  }

  /** Check for and execute any due recurring tasks */
  private async runScheduledTasks() {
    const now = new Date()

    // Find recurring tasks that are due
    const dueTasks = await db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.isRecurring, true),
          lte(schema.tasks.nextRunAt, now)
        )
      )

    // Filter out cancelled tasks in JS (status check)
    const tasksToRun = dueTasks.filter(
      (t: { status: string }) => t.status !== 'cancelled'
    )

    for (const task of tasksToRun) {
      log.info('Scheduler: executing due task', { taskId: task.id, title: task.title })

      // Calculate the next run time before executing
      let nextRunAt: Date
      try {
        nextRunAt = getNextCronRun(task.cronExpression!, now)
      } catch {
        log.error('Invalid cron for task, skipping', { taskId: task.id })
        continue
      }

      // Update lastRunAt and nextRunAt
      await db
        .update(schema.tasks)
        .set({
          lastRunAt: now,
          nextRunAt,
          status: 'running',
          startedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.tasks.id, task.id))

      // Execute the task (non-blocking)
      this.executeTask({
        id: task.id,
        userId: task.userId,
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        sessionId: task.sessionId,
      }).then(async () => {
        // After execution, reset status to 'scheduled' for next run
        await db
          .update(schema.tasks)
          .set({
            status: 'scheduled',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.tasks.id, task.id),
              eq(schema.tasks.isRecurring, true)
            )
          )
      }).catch((err) => {
        log.error('Scheduled task failed', { taskId: task.id, error: String(err) })
      })
    }
  }
}

export const taskService = new TaskService()

/** Start the task scheduler - call this during server startup */
export function startTaskScheduler() {
  taskService.startScheduler()
}
