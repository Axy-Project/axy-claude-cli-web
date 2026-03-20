import type { WsMessage, WsServerEvents } from '@axy/shared'

type EventHandler<T = unknown> = (data: T) => void

export type WsConnectionState = {
  connected: boolean
  isReconnecting: boolean
  reconnectAttempt: number
}

type ConnectionStateHandler = (state: WsConnectionState) => void

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
    // Behind reverse proxy (standard port): use same host, nginx proxies /ws
    if (port === '' || port === '80' || port === '443') {
      return `${wsProtocol}//${hostname}`
    }
    // Local dev: backend on 3456
    return `${wsProtocol}//${hostname}:3456`
  }
  return 'ws://localhost:3456'
}

class WsClient {
  private ws: WebSocket | null = null
  private listeners = new Map<string, Set<EventHandler>>()
  private token: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 20
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private pendingMessages: Array<{ type: string; data: unknown }> = []
  private connectionListeners = new Set<(connected: boolean) => void>()
  private connectionStateListeners = new Set<ConnectionStateHandler>()
  private _isReconnecting = false

  setToken(token: string | null) {
    this.token = token
    if (token) {
      this.connect()
    } else {
      this.disconnect()
    }
  }

  connect() {
    if (!this.token) return
    if (this.ws?.readyState === WebSocket.OPEN) return
    // Don't create a new connection if one is already connecting
    if (this.ws?.readyState === WebSocket.CONNECTING) return

    this.ws = new WebSocket(`${getWsUrl()}/ws?token=${this.token}`)

    this.ws.onopen = () => {
      console.log('[WS] Connected')
      this.reconnectAttempts = 0
      this._isReconnecting = false
      this.startPing()
      this.notifyConnectionListeners(true)
      this.notifyConnectionStateListeners()

      // Flush pending messages
      const pending = [...this.pendingMessages]
      this.pendingMessages = []
      for (const msg of pending) {
        this.send(msg.type, msg.data)
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data)
        if (message.type === 'pong') return
        const handlers = this.listeners.get(message.type)
        if (handlers) {
          for (const handler of handlers) {
            handler(message.data)
          }
        }
      } catch (err) {
        console.error('[WS] Parse error:', err)
      }
    }

    this.ws.onclose = (event) => {
      console.log(`[WS] Disconnected: ${event.code}`)
      this.stopPing()
      this.notifyConnectionListeners(false)
      if (event.code !== 4001 && this.token) {
        this._isReconnecting = true
        this.notifyConnectionStateListeners()
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err)
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopPing()
    this.reconnectAttempts = this.maxReconnectAttempts // prevent auto-reconnect
    this._isReconnecting = false
    this.ws?.close()
    this.ws = null
    this.pendingMessages = []
    this.notifyConnectionStateListeners()
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached')
      this._isReconnecting = false
      this.notifyConnectionStateListeners()
      return
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    this.notifyConnectionStateListeners()
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private startPing() {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30_000)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private notifyConnectionListeners(connected: boolean) {
    for (const listener of this.connectionListeners) {
      listener(connected)
    }
  }

  private notifyConnectionStateListeners() {
    const state: WsConnectionState = {
      connected: this.ws?.readyState === WebSocket.OPEN,
      isReconnecting: this._isReconnecting,
      reconnectAttempt: this.reconnectAttempts,
    }
    for (const listener of this.connectionStateListeners) {
      listener(state)
    }
  }

  /** Listen for connection state changes */
  onConnection(handler: (connected: boolean) => void): () => void {
    this.connectionListeners.add(handler)
    return () => this.connectionListeners.delete(handler)
  }

  /** Listen for detailed connection state changes (reconnecting, attempt count) */
  onConnectionState(handler: ConnectionStateHandler): () => void {
    this.connectionStateListeners.add(handler)
    return () => this.connectionStateListeners.delete(handler)
  }

  get isReconnecting(): boolean {
    return this._isReconnecting
  }

  get reconnectAttempt(): number {
    return this.reconnectAttempts
  }

  /** Subscribe to a WebSocket event type */
  on<K extends keyof WsServerEvents>(
    type: K,
    handler: EventHandler<WsServerEvents[K]>
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(handler as EventHandler)

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(handler as EventHandler)
    }
  }

  /** Send a message to the server */
  send(type: string, data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  /** Queue a message to be sent when connected (or immediately if already connected) */
  sendQueued(type: string, data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    } else {
      this.pendingMessages.push({ type, data })
    }
  }

  /** Wait for the WebSocket to be connected, then send */
  async sendWhenReady(type: string, data: unknown, timeoutMs = 5000): Promise<boolean> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
      return true
    }
    return new Promise((resolve) => {
      const start = Date.now()
      const check = () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type, data }))
          resolve(true)
        } else if (Date.now() - start > timeoutMs) {
          resolve(false)
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })
  }

  /** Subscribe to a session's events */
  subscribeToSession(sessionId: string) {
    this.sendQueued('session:subscribe', { sessionId })
  }

  /** Unsubscribe from a session's events */
  unsubscribeFromSession(sessionId: string) {
    this.send('session:unsubscribe', { sessionId })
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const wsClient = new WsClient()
