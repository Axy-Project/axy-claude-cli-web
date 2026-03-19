import { eq, and, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

class NoteService {
  async listByUser(userId: string, projectId?: string) {
    const conditions = [eq(schema.notes.userId, userId)]
    if (projectId) {
      conditions.push(eq(schema.notes.projectId, projectId))
    }
    return db
      .select()
      .from(schema.notes)
      .where(and(...conditions))
      .orderBy(desc(schema.notes.isPinned), desc(schema.notes.updatedAt))
  }

  async getById(id: string, userId: string) {
    const [note] = await db
      .select()
      .from(schema.notes)
      .where(and(eq(schema.notes.id, id), eq(schema.notes.userId, userId)))
    return note || null
  }

  async create(userId: string, input: {
    projectId?: string
    title: string
    content?: string
    color?: string
    isPinned?: boolean
    isHandwritten?: boolean
    canvasDataJson?: string
    tags?: string[]
  }) {
    const id = crypto.randomUUID()
    const now = new Date()
    await db.insert(schema.notes).values({
      id,
      userId,
      projectId: input.projectId || null,
      title: input.title,
      content: input.content || '',
      color: input.color || '#7c3aed',
      isPinned: input.isPinned || false,
      isHandwritten: input.isHandwritten || false,
      canvasDataJson: input.canvasDataJson || null,
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
    })
    return this.getById(id, userId)
  }

  async update(id: string, userId: string, input: Partial<{
    title: string
    content: string
    color: string
    isPinned: boolean
    isHandwritten: boolean
    canvasDataJson: string
    tags: string[]
    projectId: string | null
  }>) {
    await db
      .update(schema.notes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(schema.notes.id, id), eq(schema.notes.userId, userId)))
    return this.getById(id, userId)
  }

  async delete(id: string, userId: string) {
    await db
      .delete(schema.notes)
      .where(and(eq(schema.notes.id, id), eq(schema.notes.userId, userId)))
  }
}

export const noteService = new NoteService()
