import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { broadcaster } from '../ws/broadcaster.js'
import { notificationService } from './notification.service.js'

export interface TeamMessage {
  id: string
  orgId: string
  senderId: string
  senderName?: string
  senderAvatar?: string
  content: string
  replyToId?: string | null
  linkedSessionId?: string | null
  linkedProjectId?: string | null
  linkedProjectName?: string | null
  createdAt: string
  updatedAt: string
}

class TeamMessageService {
  async send(data: {
    orgId: string
    senderId: string
    content: string
    replyToId?: string
    linkedSessionId?: string
    linkedProjectId?: string
  }): Promise<TeamMessage> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.run(sql`
      INSERT INTO team_messages (id, org_id, sender_id, content, reply_to_id, linked_session_id, linked_project_id, created_at, updated_at)
      VALUES (${id}, ${data.orgId}, ${data.senderId}, ${data.content}, ${data.replyToId || null}, ${data.linkedSessionId || null}, ${data.linkedProjectId || null}, ${now}, ${now})
    `)

    // Get sender info
    const senderRows = await db.all(sql`
      SELECT display_name, avatar_url FROM users WHERE id = ${data.senderId}
    `) as any[]
    const sender = senderRows[0]

    const message: TeamMessage = {
      id,
      orgId: data.orgId,
      senderId: data.senderId,
      senderName: sender?.display_name,
      senderAvatar: sender?.avatar_url,
      content: data.content,
      replyToId: data.replyToId,
      linkedSessionId: data.linkedSessionId,
      linkedProjectId: data.linkedProjectId,
      createdAt: now,
      updatedAt: now,
    }

    // Notify all org members via WebSocket (except sender)
    const members = await db.all(sql`
      SELECT user_id FROM org_members WHERE org_id = ${data.orgId} AND user_id != ${data.senderId}
    `) as any[]

    for (const member of members) {
      broadcaster.toUser(member.user_id, 'team:message', message as any)

      // Create notification for each member (non-blocking — don't fail message send if notification fails)
      notificationService.create(member.user_id, {
        type: 'team_message',
        title: `${sender?.display_name || 'Someone'} in team chat`,
        body: data.content.length > 100 ? data.content.slice(0, 100) + '...' : data.content,
        link: `/org/${data.orgId}/chat`,
        metadata: { orgId: data.orgId, messageId: id },
      }).catch((err) => console.error('[TeamMessage] Failed to create notification:', err))
    }

    return message
  }

  async list(orgId: string, opts: { limit?: number; before?: string } = {}): Promise<TeamMessage[]> {
    const { limit = 50, before } = opts
    const beforeFilter = before ? sql`AND tm.created_at < ${before}` : sql``

    const rows = await db.all(sql`
      SELECT tm.id, tm.org_id, tm.sender_id, tm.content, tm.reply_to_id,
             tm.linked_session_id, tm.linked_project_id, tm.created_at, tm.updated_at,
             u.display_name as sender_name, u.avatar_url as sender_avatar,
             p.name as linked_project_name
      FROM team_messages tm
      LEFT JOIN users u ON tm.sender_id = u.id
      LEFT JOIN projects p ON tm.linked_project_id = p.id
      WHERE tm.org_id = ${orgId} ${beforeFilter}
      ORDER BY tm.created_at DESC
      LIMIT ${limit}
    `) as any[]

    return rows.map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      senderAvatar: r.sender_avatar,
      content: r.content,
      replyToId: r.reply_to_id,
      linkedSessionId: r.linked_session_id,
      linkedProjectId: r.linked_project_id,
      linkedProjectName: r.linked_project_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })).reverse() // Return chronological order
  }

  async delete(messageId: string, userId: string): Promise<boolean> {
    const rows = await db.all(sql`
      SELECT sender_id FROM team_messages WHERE id = ${messageId}
    `) as any[]
    if (!rows[0] || rows[0].sender_id !== userId) return false
    await db.run(sql`DELETE FROM team_messages WHERE id = ${messageId}`)
    return true
  }
}

export const teamMessageService = new TeamMessageService()
