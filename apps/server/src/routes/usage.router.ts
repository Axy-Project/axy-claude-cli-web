import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { db, schema } from '../db/index.js'
import { eq, and, sql, desc, gte } from 'drizzle-orm'

const router = Router()
router.use(authMiddleware)

/** GET /api/usage/summary - Total tokens and session count for the user */
router.get('/summary', async (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayStartUnix = Math.floor(dayStart.getTime() / 1000)

    const [allTime] = await db
      .select({
        totalInputTokens: sql<number>`coalesce(sum(${schema.sessions.totalInputTokens}), 0)`,
        totalOutputTokens: sql<number>`coalesce(sum(${schema.sessions.totalOutputTokens}), 0)`,
        sessionsCount: sql<number>`count(*)`,
      })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, req.userId!))

    const [today] = await db
      .select({
        todayInputTokens: sql<number>`coalesce(sum(${schema.sessions.totalInputTokens}), 0)`,
        todayOutputTokens: sql<number>`coalesce(sum(${schema.sessions.totalOutputTokens}), 0)`,
      })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, req.userId!),
          gte(schema.sessions.createdAt, new Date(dayStartUnix * 1000))
        )
      )

    res.json({
      success: true,
      data: {
        totalInputTokens: allTime.totalInputTokens,
        totalOutputTokens: allTime.totalOutputTokens,
        sessionsCount: allTime.sessionsCount,
        todayInputTokens: today.todayInputTokens,
        todayOutputTokens: today.todayOutputTokens,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/usage/by-model - Usage breakdown by model */
router.get('/by-model', async (req: AuthenticatedRequest, res) => {
  try {
    const results = await db
      .select({
        model: schema.sessions.model,
        totalInput: sql<number>`coalesce(sum(${schema.sessions.totalInputTokens}), 0)`,
        totalOutput: sql<number>`coalesce(sum(${schema.sessions.totalOutputTokens}), 0)`,
        sessionCount: sql<number>`count(*)`,
      })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, req.userId!))
      .groupBy(schema.sessions.model)
      .orderBy(desc(sql`sum(${schema.sessions.totalInputTokens}) + sum(${schema.sessions.totalOutputTokens})`))

    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/usage/by-day?days=30 - Daily usage for the last N days */
router.get('/by-day', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffUnix = Math.floor(cutoff.getTime() / 1000)

    const results = await db
      .select({
        date: sql<string>`date(${schema.sessions.createdAt}, 'unixepoch')`,
        totalInput: sql<number>`coalesce(sum(${schema.sessions.totalInputTokens}), 0)`,
        totalOutput: sql<number>`coalesce(sum(${schema.sessions.totalOutputTokens}), 0)`,
      })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, req.userId!),
          gte(schema.sessions.createdAt, new Date(cutoffUnix * 1000))
        )
      )
      .groupBy(sql`date(${schema.sessions.createdAt}, 'unixepoch')`)
      .orderBy(sql`date(${schema.sessions.createdAt}, 'unixepoch')`)

    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/usage/by-project - Usage per project */
router.get('/by-project', async (req: AuthenticatedRequest, res) => {
  try {
    const results = await db
      .select({
        projectId: schema.projects.id,
        projectName: schema.projects.name,
        totalInput: sql<number>`coalesce(sum(${schema.sessions.totalInputTokens}), 0)`,
        totalOutput: sql<number>`coalesce(sum(${schema.sessions.totalOutputTokens}), 0)`,
        sessionCount: sql<number>`count(*)`,
      })
      .from(schema.sessions)
      .innerJoin(schema.projects, eq(schema.sessions.projectId, schema.projects.id))
      .where(eq(schema.sessions.userId, req.userId!))
      .groupBy(schema.projects.id, schema.projects.name)
      .orderBy(desc(sql`sum(${schema.sessions.totalInputTokens}) + sum(${schema.sessions.totalOutputTokens})`))

    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/usage/recent - Last 20 token usage records with session info */
router.get('/recent', async (req: AuthenticatedRequest, res) => {
  try {
    const results = await db
      .select({
        id: schema.tokenUsage.id,
        model: schema.tokenUsage.model,
        inputTokens: schema.tokenUsage.inputTokens,
        outputTokens: schema.tokenUsage.outputTokens,
        createdAt: schema.tokenUsage.createdAt,
        sessionId: schema.tokenUsage.sessionId,
        sessionTitle: schema.sessions.title,
      })
      .from(schema.tokenUsage)
      .leftJoin(schema.sessions, eq(schema.tokenUsage.sessionId, schema.sessions.id))
      .where(eq(schema.tokenUsage.userId, req.userId!))
      .orderBy(desc(schema.tokenUsage.createdAt))
      .limit(20)

    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
