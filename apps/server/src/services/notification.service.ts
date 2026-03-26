import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { broadcaster } from '../ws/broadcaster.js'

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  read: boolean
  metadataJson?: unknown
  createdAt: string
}

class NotificationService {
  async create(userId: string, data: { type: string; title: string; body?: string; link?: string; metadata?: Record<string, unknown> }): Promise<Notification> {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.run(sql`
      INSERT INTO notifications (id, user_id, type, title, body, link, read, metadata_json, created_at)
      VALUES (${id}, ${userId}, ${data.type}, ${data.title}, ${data.body || null}, ${data.link || null}, 0, ${JSON.stringify(data.metadata || {})}, ${now.toISOString()})
    `)

    const notification: Notification = {
      id,
      userId,
      type: data.type,
      title: data.title,
      body: data.body,
      link: data.link,
      read: false,
      metadataJson: data.metadata || {},
      createdAt: now.toISOString(),
    }

    // Push to user via WebSocket in real-time
    broadcaster.toUser(userId, 'notification:new', notification as any)

    return notification
  }

  async list(userId: string, opts: { limit?: number; unreadOnly?: boolean } = {}): Promise<Notification[]> {
    const { limit = 50, unreadOnly = false } = opts
    const readFilter = unreadOnly ? sql`AND read = 0` : sql``
    const rows = await db.all(sql`
      SELECT id, user_id, type, title, body, link, read, metadata_json, created_at
      FROM notifications
      WHERE user_id = ${userId} ${readFilter}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as any[]

    return rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      read: Boolean(r.read),
      metadataJson: typeof r.metadata_json === 'string' ? JSON.parse(r.metadata_json) : r.metadata_json,
      createdAt: r.created_at,
    }))
  }

  async unreadCount(userId: string): Promise<number> {
    const result = await db.all(sql`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ${userId} AND read = 0
    `) as any[]
    return Number(result[0]?.count || 0)
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await db.run(sql`
      UPDATE notifications SET read = 1 WHERE id = ${notificationId} AND user_id = ${userId}
    `)
  }

  async markAllRead(userId: string): Promise<void> {
    await db.run(sql`
      UPDATE notifications SET read = 1 WHERE user_id = ${userId} AND read = 0
    `)
  }

  async delete(userId: string, notificationId: string): Promise<void> {
    await db.run(sql`
      DELETE FROM notifications WHERE id = ${notificationId} AND user_id = ${userId}
    `)
  }
}

export const notificationService = new NotificationService()
