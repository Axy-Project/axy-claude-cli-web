import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { db, schema } from '../db/index.js'
import { eq, and, like, or } from 'drizzle-orm'

const router = Router()
router.use(authMiddleware)

interface SearchResults {
  projects: unknown[]
  sessions: unknown[]
  messages: unknown[]
  notes: unknown[]
}

/** GET /api/search?q=query&type=all|projects|sessions|messages|notes */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { q, type = 'all' } = req.query as { q: string; type?: string }
    const userId = req.userId!

    if (!q || q.length < 2) {
      res.status(400).json({ success: false, error: 'Query must be at least 2 characters' })
      return
    }

    const results: SearchResults = { projects: [], sessions: [], messages: [], notes: [] }
    const searchTerm = `%${q}%`

    // Search projects (name, description)
    if (type === 'all' || type === 'projects') {
      results.projects = await db
        .select()
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.userId, userId),
            or(
              like(schema.projects.name, searchTerm),
              like(schema.projects.description, searchTerm)
            )
          )
        )
        .limit(10)
    }

    // Search sessions (title)
    if (type === 'all' || type === 'sessions') {
      results.sessions = await db
        .select({
          id: schema.sessions.id,
          projectId: schema.sessions.projectId,
          title: schema.sessions.title,
          model: schema.sessions.model,
          createdAt: schema.sessions.createdAt,
        })
        .from(schema.sessions)
        .where(
          and(
            eq(schema.sessions.userId, userId),
            like(schema.sessions.title, searchTerm)
          )
        )
        .limit(10)
    }

    // Search messages (contentJson contains text) - use LIKE on the JSON text
    if (type === 'all' || type === 'messages') {
      results.messages = await db
        .select({
          id: schema.messages.id,
          sessionId: schema.messages.sessionId,
          role: schema.messages.role,
          contentJson: schema.messages.contentJson,
          createdAt: schema.messages.createdAt,
          projectId: schema.sessions.projectId,
        })
        .from(schema.messages)
        .innerJoin(schema.sessions, eq(schema.messages.sessionId, schema.sessions.id))
        .where(
          and(
            eq(schema.sessions.userId, userId),
            like(schema.messages.contentJson, searchTerm)
          )
        )
        .limit(10)
    }

    // Search notes (title, content)
    if (type === 'all' || type === 'notes') {
      results.notes = await db
        .select()
        .from(schema.notes)
        .where(
          and(
            eq(schema.notes.userId, userId),
            or(
              like(schema.notes.title, searchTerm),
              like(schema.notes.content, searchTerm)
            )
          )
        )
        .limit(10)
    }

    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
