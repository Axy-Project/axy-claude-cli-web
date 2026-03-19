import { wsManager } from './manager.js'
import type { WsServerEvents } from '@axy/shared'

/**
 * Type-safe broadcaster for sending WebSocket events to clients.
 */
export const broadcaster = {
  /** Auto-subscribe a user to session events (call before emitting) */
  subscribeUserToSession(userId: string, sessionId: string): void {
    wsManager.subscribeUserToSession(userId, sessionId)
  },

  /** Send event to all clients subscribed to a session */
  toSession<K extends keyof WsServerEvents>(
    sessionId: string,
    type: K,
    data: WsServerEvents[K]
  ): void {
    wsManager.sendToSession(sessionId, type, data)
  },

  /** Send event to a specific user */
  toUser<K extends keyof WsServerEvents>(
    userId: string,
    type: K,
    data: WsServerEvents[K]
  ): void {
    wsManager.sendToUser(userId, type, data)
  },

  /** Send event to all clients subscribed to a terminal */
  toTerminal<K extends keyof WsServerEvents>(
    terminalId: string,
    type: K,
    data: WsServerEvents[K]
  ): void {
    wsManager.sendToTerminal(terminalId, type, data)
  },
}
