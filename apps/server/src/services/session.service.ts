import { eq, and, desc, lt, sql, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { CreateSessionInput } from '@axy/shared'

export class SessionService {
  async listByProject(projectId: string, userId: string) {
    return db
      .select()
      .from(schema.sessions)
      .where(and(
        eq(schema.sessions.projectId, projectId),
        eq(schema.sessions.userId, userId)
      ))
      .orderBy(desc(schema.sessions.updatedAt))
  }

  async getById(sessionId: string, userId: string) {
    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(and(
        eq(schema.sessions.id, sessionId),
        eq(schema.sessions.userId, userId)
      ))
      .limit(1)
    return session || null
  }

  async create(userId: string, input: CreateSessionInput) {
    const [session] = await db
      .insert(schema.sessions)
      .values({
        projectId: input.projectId,
        userId,
        title: input.title,
        model: input.model || 'claude-sonnet-4-6',
        mode: input.mode || 'code',
      })
      .returning()
    return session
  }

  async update(sessionId: string, userId: string, data: { model?: string; title?: string; isPinned?: number; effort?: string }) {
    const [session] = await db
      .update(schema.sessions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.sessions.id, sessionId),
        eq(schema.sessions.userId, userId)
      ))
      .returning()
    return session || null
  }

  async updateCliSessionId(sessionId: string, cliSessionId: string) {
    await db
      .update(schema.sessions)
      .set({ cliSessionId })
      .where(eq(schema.sessions.id, sessionId))
  }

  async delete(sessionId: string, userId: string) {
    // Delete dependent records first (FK constraints)
    await db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId))
    await db.delete(schema.tokenUsage).where(eq(schema.tokenUsage.sessionId, sessionId))
    await db
      .delete(schema.sessions)
      .where(and(
        eq(schema.sessions.id, sessionId),
        eq(schema.sessions.userId, userId)
      ))
  }

  async getMessages(sessionId: string, opts?: { limit?: number; before?: string }) {
    const limit = opts?.limit ?? 50
    const beforeId = opts?.before

    let beforeTimestamp: Date | undefined
    if (beforeId) {
      const [pivot] = await db
        .select({ createdAt: schema.messages.createdAt })
        .from(schema.messages)
        .where(eq(schema.messages.id, beforeId))
        .limit(1)
      if (pivot) {
        beforeTimestamp = pivot.createdAt
      }
    }

    const conditions = [eq(schema.messages.sessionId, sessionId)]
    if (beforeTimestamp) {
      conditions.push(lt(schema.messages.createdAt, beforeTimestamp))
    }

    // Fetch limit + 1 to determine hasMore
    const rows = await db
      .select()
      .from(schema.messages)
      .where(and(...conditions))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const sliced = rows.slice(0, limit)

    // Reverse so oldest-first (ASC) for the client
    sliced.reverse()

    return { messages: sliced, hasMore }
  }

  async addMessage(sessionId: string, data: {
    role: string
    contentJson: unknown
    model?: string
    inputTokens?: number
    outputTokens?: number
    costUsd?: number
    durationMs?: number
    toolCallsJson?: unknown
    thinkingJson?: unknown
  }) {
    const [message] = await db
      .insert(schema.messages)
      .values({
        sessionId,
        role: data.role,
        contentJson: data.contentJson,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        costUsd: data.costUsd,
        durationMs: data.durationMs,
        toolCallsJson: data.toolCallsJson,
        thinkingJson: data.thinkingJson,
      })
      .returning()

    // Update session totals
    if (data.inputTokens || data.outputTokens || data.costUsd) {
      const [session] = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, sessionId))
        .limit(1)

      if (session) {
        await db
          .update(schema.sessions)
          .set({
            totalInputTokens: session.totalInputTokens + (data.inputTokens || 0),
            totalOutputTokens: session.totalOutputTokens + (data.outputTokens || 0),
            totalCostUsd: session.totalCostUsd + (data.costUsd || 0),
            updatedAt: new Date(),
          })
          .where(eq(schema.sessions.id, sessionId))
      }
    }

    return message
  }
  async bulkDelete(ids: string[], userId: string) {
    // Validate all sessions belong to the user
    const owned = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(and(
        inArray(schema.sessions.id, ids),
        eq(schema.sessions.userId, userId)
      ))
    const ownedIds = owned.map((s: { id: string }) => s.id)
    if (ownedIds.length !== ids.length) {
      throw new Error('Some sessions not found or not owned by user')
    }

    // Delete dependent records, then sessions
    await db.delete(schema.messages).where(inArray(schema.messages.sessionId, ownedIds))
    await db.delete(schema.tokenUsage).where(inArray(schema.tokenUsage.sessionId, ownedIds))
    await db.delete(schema.sessions).where(inArray(schema.sessions.id, ownedIds))

    return ownedIds.length
  }

  async branchFrom(sessionId: string, fromMessageId: string, userId: string) {
    // 1. Get the original session
    const original = await this.getById(sessionId, userId)
    if (!original) throw new Error('Session not found')

    // 2. Get the pivot message
    type Msg = { id: string; createdAt: Date | string; role: string; contentJson: unknown; model: string | null; inputTokens: number | null; outputTokens: number | null; costUsd: number | null; durationMs: number | null; toolCallsJson: unknown; thinkingJson: unknown }
    const { messages: allMessages } = await this.getMessages(sessionId, { limit: 100000 })
    const pivotMessage = allMessages.find((m: Msg) => m.id === fromMessageId)
    if (!pivotMessage) throw new Error('Message not found')

    // 3. Get all messages up to and including the pivot message
    const messagesToCopy = allMessages.filter(
      (m: Msg) =>
        new Date(m.createdAt).getTime() <= new Date(pivotMessage.createdAt).getTime()
    )

    // 4. Create a new session with parentSessionId
    const [newSession] = await db
      .insert(schema.sessions)
      .values({
        projectId: original.projectId,
        userId,
        title: `${original.title || 'Chat'} (branch)`,
        model: original.model,
        mode: original.mode,
        parentSessionId: sessionId,
      })
      .returning()

    // 5. Copy messages to the new session with new IDs (batch insert)
    if (messagesToCopy.length > 0) {
      await db.insert(schema.messages).values(
        messagesToCopy.map((msg: Msg) => ({
          sessionId: newSession.id,
          role: msg.role,
          contentJson: msg.contentJson,
          model: msg.model,
          inputTokens: msg.inputTokens,
          outputTokens: msg.outputTokens,
          costUsd: msg.costUsd,
          durationMs: msg.durationMs,
          toolCallsJson: msg.toolCallsJson,
          thinkingJson: msg.thinkingJson,
        }))
      )
    }

    return newSession
  }
}

export const sessionService = new SessionService()
