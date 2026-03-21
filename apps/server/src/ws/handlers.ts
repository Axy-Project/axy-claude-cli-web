import type { WebSocket } from 'ws'
import type { WsMessage } from '@axy/shared'
import { terminalService } from '../services/terminal.service.js'
import { projectService } from '../services/project.service.js'

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string
  sessionSubscriptions: Set<string>
  terminalSubscriptions: Set<string>
}

export async function handleWsMessage(ws: AuthenticatedWebSocket, message: WsMessage): Promise<void> {
  const { type, data } = message

  switch (type) {
    case 'session:subscribe': {
      const { sessionId } = data as { sessionId: string }
      ws.sessionSubscriptions.add(sessionId)
      // Note: replay is handled client-side via REST /stream-status endpoint
      // to avoid double-processing with the store's checkAndReplayStream
      break
    }

    case 'session:unsubscribe': {
      const { sessionId } = data as { sessionId: string }
      ws.sessionSubscriptions.delete(sessionId)
      break
    }

    case 'chat:send': {
      const { sessionId } = data as { sessionId: string }
      ws.sessionSubscriptions.add(sessionId)
      break
    }

    case 'chat:stop': {
      break
    }

    case 'permission:respond': {
      break
    }

    case 'terminal:create-login': {
      // Create a plain bash terminal for the user to run claude auth login manually
      if (!ws.userId) break
      try {
        const terminalId = terminalService.create({
          userId: ws.userId,
          projectId: '__login__',
          projectPath: '/tmp',
        })
        ws.terminalSubscriptions.add(terminalId)
        ws.send(JSON.stringify({ type: 'terminal:created', data: { terminalId, projectId: '__login__' } }))
      } catch (err) {
        ws.send(JSON.stringify({ type: 'terminal:error', data: { error: 'Failed to start Claude login terminal' } }))
      }
      break
    }

    case 'terminal:create': {
      const { projectId } = data as { projectId: string }
      if (!ws.userId) break

      try {
        // Look up project path via service
        const project = await projectService.getById(projectId, ws.userId)
        const projectPath = project?.localPath || process.cwd()

        const terminalId = terminalService.create({
          userId: ws.userId,
          projectId,
          projectPath,
        })

        ws.terminalSubscriptions.add(terminalId)

        // Send back the terminal ID
        ws.send(JSON.stringify({
          type: 'terminal:created',
          data: { terminalId, projectId },
        }))

        console.log(`[WS] Terminal created: ${terminalId} for project ${projectId}`)
      } catch (err) {
        console.error('[WS] Terminal create error:', err)
        ws.send(JSON.stringify({
          type: 'terminal:error',
          data: { error: 'Failed to create terminal' },
        }))
      }
      break
    }

    case 'terminal:write': {
      const { terminalId, data: inputData } = data as { terminalId: string; data: string }
      terminalService.write(terminalId, inputData)
      break
    }

    case 'terminal:resize': {
      const { terminalId, cols, rows } = data as { terminalId: string; cols: number; rows: number }
      terminalService.resize(terminalId, cols, rows)
      break
    }

    case 'terminal:destroy': {
      const { terminalId } = data as { terminalId: string }
      ws.terminalSubscriptions.delete(terminalId)
      terminalService.destroy(terminalId)
      break
    }

    default:
      console.warn(`[WS] Unknown message type: ${type}`)
  }
}
