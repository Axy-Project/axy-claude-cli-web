import { eq, desc, and, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export interface ActivityItem {
  id: string
  type: 'session_created' | 'message_sent' | 'task_completed' | 'project_created'
  title: string
  description?: string
  projectId?: string
  projectName?: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export class ActivityService {
  async getRecentActivity(userId: string, limit = 30): Promise<ActivityItem[]> {
    const items: ActivityItem[] = []

    // Get all user projects for name lookup
    const allProjects = await db
      .select({ id: schema.projects.id, name: schema.projects.name })
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId))

    const projectMap = new Map(allProjects.map((p: { id: string; name: string }) => [p.id, p.name]))

    // 1. Recent sessions (session_created)
    const recentSessions = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))
      .orderBy(desc(schema.sessions.createdAt))
      .limit(limit)

    for (const session of recentSessions) {
      items.push({
        id: `session-${session.id}`,
        type: 'session_created',
        title: session.title || 'New chat session',
        description: `Model: ${session.model} | Mode: ${session.mode}`,
        projectId: session.projectId,
        projectName: String(projectMap.get(session.projectId) || '') || undefined,
        createdAt: new Date(session.createdAt).toISOString(),
        metadata: { sessionId: session.id, model: session.model },
      })
    }

    // 2. Recent assistant messages (message_sent) - only from user's sessions
    const userSessionIds = recentSessions.map((s: any) => s.id)
    if (userSessionIds.length > 0) {
      const recentMessages = await db
        .select()
        .from(schema.messages)
        .where(and(
          eq(schema.messages.role, 'assistant'),
          inArray(schema.messages.sessionId, userSessionIds)
        ))
        .orderBy(desc(schema.messages.createdAt))
        .limit(limit * 2)

      // Group by sessionId, count messages
      const sessionMessageCounts = new Map<string, { count: number; lastAt: Date }>()
      for (const msg of recentMessages) {
        const existing = sessionMessageCounts.get(msg.sessionId)
        if (existing) {
          existing.count++
        } else {
          sessionMessageCounts.set(msg.sessionId, {
            count: 1,
            lastAt: new Date(msg.createdAt),
          })
        }
      }

      // Build session title map from already-fetched sessions (no N+1)
      const sessionTitleMap = new Map(recentSessions.map((s: any) => [s.id, { title: s.title, projectId: s.projectId }]))

      for (const [sessionId, data] of sessionMessageCounts) {
        const session = sessionTitleMap.get(sessionId) as { title: string; projectId: string } | undefined
        if (session) {
          items.push({
            id: `messages-${sessionId}-${data.lastAt.getTime()}`,
            type: 'message_sent',
            title: `${data.count} response${data.count > 1 ? 's' : ''} in "${session.title || 'Chat'}"`,
            projectId: session.projectId,
            projectName: String(projectMap.get(session.projectId) || '') || undefined,
            createdAt: data.lastAt.toISOString(),
            metadata: { sessionId, messageCount: data.count },
          })
        }
      }
    }

    // 3. Recent completed tasks (task_completed)
    const completedTasks = await db
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.status, 'completed')))
      .orderBy(desc(schema.tasks.completedAt))
      .limit(limit)

    for (const task of completedTasks) {
      items.push({
        id: `task-${task.id}`,
        type: 'task_completed',
        title: task.title,
        description: task.description || undefined,
        projectId: task.projectId,
        projectName: String(projectMap.get(task.projectId) || '') || undefined,
        createdAt: task.completedAt
          ? new Date(task.completedAt).toISOString()
          : new Date(task.updatedAt).toISOString(),
        metadata: { taskId: task.id, type: task.type },
      })
    }

    // 4. Recent projects (project_created)
    const recentProjects = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId))
      .orderBy(desc(schema.projects.createdAt))
      .limit(limit)

    for (const project of recentProjects) {
      items.push({
        id: `project-${project.id}`,
        type: 'project_created',
        title: `Created project "${project.name}"`,
        description: project.description || undefined,
        projectId: project.id,
        projectName: project.name,
        createdAt: new Date(project.createdAt).toISOString(),
        metadata: { projectId: project.id },
      })
    }

    // Sort by createdAt desc and limit
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return items.slice(0, limit)
  }
}

export const activityService = new ActivityService()
