import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { handleWsMessage } from './handlers.js'
import { logger } from '../lib/logger.js'
import { terminalService } from '../services/terminal.service.js'

const log = logger.child('ws')

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string
  sessionSubscriptions: Set<string>
  terminalSubscriptions: Set<string>
  isAlive: boolean
}

class WsManager {
  private wss: WebSocketServer | null = null
  private clients = new Map<string, Set<AuthenticatedWebSocket>>()

  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' })

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      ws.sessionSubscriptions = new Set()
      ws.terminalSubscriptions = new Set()
      ws.isAlive = true

      // Authenticate via query param token
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const token = url.searchParams.get('token')

      if (!token) {
        ws.close(4001, 'Authentication required')
        return
      }

      try {
        const payload = jwt.verify(token, config.jwtSecret) as { sub: string }
        ws.userId = payload.sub

        // Track client
        if (!this.clients.has(ws.userId)) {
          this.clients.set(ws.userId, new Set())
        }
        this.clients.get(ws.userId)!.add(ws)

        log.info('Client connected', { userId: ws.userId })
      } catch {
        ws.close(4001, 'Invalid token')
        return
      }

      ws.on('pong', () => {
        ws.isAlive = true
      })

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString())
          await handleWsMessage(ws, message)
        } catch (err) {
          log.error('Invalid message', { error: String(err) })
        }
      })

      ws.on('close', () => {
        if (ws.userId) {
          const userClients = this.clients.get(ws.userId)
          if (userClients) {
            userClients.delete(ws)
            if (userClients.size === 0) {
              this.clients.delete(ws.userId)
              // All connections gone - clean up user's terminals
              terminalService.destroyAllForUser(ws.userId)
              log.info('Cleaned up terminals for disconnected user', { userId: ws.userId })
            }
          }
          log.info('Client disconnected', { userId: ws.userId })
        }
      })

      ws.on('error', (err) => {
        log.error('WebSocket error', { userId: ws.userId, error: err.message })
      })
    })

    // Heartbeat to detect stale connections
    const interval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket
        if (!authWs.isAlive) {
          authWs.terminate()
          return
        }
        authWs.isAlive = false
        authWs.ping()
      })
    }, 30000)

    this.wss.on('close', () => clearInterval(interval))
  }

  /** Send a message to all connections of a specific user */
  sendToUser(userId: string, type: string, data: unknown): void {
    const userClients = this.clients.get(userId)
    if (!userClients) return

    const message = JSON.stringify({ type, data })
    for (const ws of userClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    }
  }

  /** Send a message to all users subscribed to a session */
  sendToSession(sessionId: string, type: string, data: unknown): void {
    const message = JSON.stringify({ type, data })
    this.wss?.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket
      if (authWs.readyState === WebSocket.OPEN && authWs.sessionSubscriptions.has(sessionId)) {
        authWs.send(message)
      }
    })
  }

  /** Send a message to all users subscribed to a terminal */
  sendToTerminal(terminalId: string, type: string, data: unknown): void {
    const message = JSON.stringify({ type, data })
    this.wss?.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket
      if (authWs.readyState === WebSocket.OPEN && authWs.terminalSubscriptions.has(terminalId)) {
        authWs.send(message)
      }
    })
  }

  /** Auto-subscribe a user's WS connections to a session (server-side) */
  subscribeUserToSession(userId: string, sessionId: string): void {
    const userClients = this.clients.get(userId)
    if (!userClients) return
    for (const ws of userClients) {
      const authWs = ws as AuthenticatedWebSocket
      authWs.sessionSubscriptions.add(sessionId)
    }
  }

  /** Broadcast to all authenticated clients */
  broadcast(type: string, data: unknown): void {
    const message = JSON.stringify({ type, data })
    this.wss?.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    })
  }
}

export const wsManager = new WsManager()
