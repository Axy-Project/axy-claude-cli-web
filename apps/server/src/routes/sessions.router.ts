import { Router } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { param } from '../middleware/params.js'
import { sessionService } from '../services/session.service.js'
import { streamBuffer } from '../services/stream-buffer.js'
import { claudeService } from '../services/claude.service.js'

const router = Router()
router.use(authMiddleware)

/** GET /api/projects/:projectId/sessions */
router.get('/project/:projectId', async (req: AuthenticatedRequest, res) => {
  try {
    const sessions = await sessionService.listByProject(param(req, 'projectId'), req.userId!)
    res.json({ success: true, data: sessions })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/sessions/:id */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const session = await sessionService.getById(param(req, 'id'), req.userId!)
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }
    res.json({ success: true, data: session })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/sessions */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const session = await sessionService.create(req.userId!, req.body)
    res.status(201).json({ success: true, data: session })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** PATCH /api/sessions/:id */
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const session = await sessionService.update(param(req, 'id'), req.userId!, req.body)
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }
    res.json({ success: true, data: session })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/sessions/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await sessionService.delete(param(req, 'id'), req.userId!)
    res.json({ success: true, message: 'Session deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** DELETE /api/sessions/:id/messages - Clear all messages in a session */
router.delete('/:id/messages', async (req: AuthenticatedRequest, res) => {
  try {
    await sessionService.clearMessages(param(req, 'id'), req.userId!)
    res.json({ success: true, message: 'Session messages cleared' })
  } catch (error) {
    const status = (error as Error).message.includes('not found') ? 404 : 500
    res.status(status).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/sessions/bulk-delete - Delete multiple sessions at once */
router.post('/bulk-delete', async (req: AuthenticatedRequest, res) => {
  try {
    const { ids } = req.body as { ids?: string[] }
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'ids array is required' })
      return
    }
    const deletedCount = await sessionService.bulkDelete(ids, req.userId!)
    res.json({ success: true, data: { deletedCount } })
  } catch (error) {
    const status = (error as Error).message.includes('not found') ? 403 : 500
    res.status(status).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/sessions/:id/branch - Fork a session from a specific message */
router.post('/:id/branch', async (req: AuthenticatedRequest, res) => {
  try {
    const { fromMessageId } = req.body
    if (!fromMessageId) {
      res.status(400).json({ success: false, error: 'fromMessageId is required' })
      return
    }
    const newSession = await sessionService.branchFrom(param(req, 'id'), fromMessageId, req.userId!)
    res.status(201).json({ success: true, data: newSession })
  } catch (error) {
    const status = (error as Error).message.includes('not found') ? 404 : 500
    res.status(status).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/sessions/:id/messages?limit=50&before=messageId */
router.get('/:id/messages', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    const before = req.query.before as string | undefined
    const result = await sessionService.getMessages(param(req, 'id'), { limit, before })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/sessions/:id/stream-status - Check if CLI is active + get buffered events for replay */
router.get('/:id/stream-status', async (req: AuthenticatedRequest, res) => {
  try {
    const sessionId = param(req, 'id')
    const isActive = claudeService.isSessionActive(sessionId)
    const status = streamBuffer.getStatus(sessionId)
    const events = streamBuffer.getEvents(sessionId)
    console.log(`[Stream] Status for ${sessionId}: active=${isActive}, bufferActive=${status.isActive}, events=${status.eventCount}`)
    res.json({
      success: true,
      data: {
        isActive: isActive || status.isActive,
        eventCount: status.eventCount,
        startedAt: status.startedAt,
        events,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/sessions/:id/export?format=markdown|json - Export a session */
router.get('/:id/export', async (req: AuthenticatedRequest, res) => {
  try {
    const id = param(req, 'id')
    const format = (req.query.format as string) || 'json'

    const session = await sessionService.getById(id, req.userId!)
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }

    // Fetch messages for export (capped to prevent OOM)
    const { messages } = await sessionService.getMessages(id, { limit: 5000 })

    if (format === 'markdown') {
      let md = `# ${session.title || 'Chat Session'}\n\n`
      md += `**Model:** ${session.model}  \n`
      md += `**Mode:** ${session.mode}  \n`
      md += `**Created:** ${new Date(session.createdAt).toISOString()}  \n\n---\n\n`

      for (const msg of messages) {
        const role = msg.role === 'user' ? 'User' : 'Assistant'
        md += `## ${role}\n\n`

        // Render content blocks
        const blocks = (msg.contentJson as unknown[]) || []
        for (const block of blocks) {
          const b = block as Record<string, unknown>
          if (b.type === 'text') {
            md += `${b.text}\n\n`
          } else if (b.type === 'code') {
            md += `\`\`\`${(b.language as string) || ''}\n${b.text}\n\`\`\`\n\n`
          }
        }

        // Tool calls as collapsible sections
        const toolCalls = (msg.toolCallsJson as unknown[]) || []
        if (toolCalls.length > 0) {
          for (const tc of toolCalls) {
            const t = tc as Record<string, unknown>
            md += `<details>\n<summary>Tool: ${t.name || 'unknown'}</summary>\n\n`
            if (t.input) {
              md += `**Input:**\n\`\`\`json\n${JSON.stringify(t.input, null, 2)}\n\`\`\`\n\n`
            }
            if (t.result) {
              md += `**Result:**\n\`\`\`\n${t.result}\n\`\`\`\n\n`
            }
            md += `</details>\n\n`
          }
        }

        md += `---\n\n`
      }

      // Token usage summary
      md += `## Token Usage Summary\n\n`
      md += `| Metric | Value |\n|--------|-------|\n`
      md += `| Input Tokens | ${session.totalInputTokens} |\n`
      md += `| Output Tokens | ${session.totalOutputTokens} |\n`
      md += `| Total Cost | $${Number(session.totalCostUsd).toFixed(4)} |\n`

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${(session.title || 'session').replace(/[^a-zA-Z0-9_-]/g, '_')}.md"`
      )
      res.send(md)
    } else {
      // JSON format - full session with messages
      const data = {
        ...session,
        messages,
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${(session.title || 'session').replace(/[^a-zA-Z0-9_-]/g, '_')}.json"`
      )
      res.json({ success: true, data })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
