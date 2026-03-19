/**
 * In-memory buffer for CLI streaming events.
 * Stores events per session so they can be replayed when a client reconnects.
 * Buffer is cleared when the CLI process completes.
 */

interface BufferedEvent {
  type: string
  data: unknown
  timestamp: number
}

interface SessionBuffer {
  events: BufferedEvent[]
  isActive: boolean
  startedAt: number
}

const MAX_EVENTS_PER_SESSION = 5000
const BUFFER_TTL_MS = 5 * 60_000 // 5 min after completion (enough time for page refresh)
const CLEANUP_INTERVAL_MS = 5 * 60_000 // Check every 5 minutes
const MAX_BUFFER_AGE_MS = 4 * 60 * 60_000 // 4 hours max even if active

class StreamBuffer {
  private buffers = new Map<string, SessionBuffer>()
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor() {
    // Periodic cleanup of stale buffers
    this.cleanupTimer = setInterval(() => this.cleanupStale(), CLEANUP_INTERVAL_MS)
  }

  /** Start buffering for a session */
  start(sessionId: string): void {
    this.buffers.set(sessionId, {
      events: [],
      isActive: true,
      startedAt: Date.now(),
    })
  }

  /** Add an event to the buffer */
  push(sessionId: string, type: string, data: unknown): void {
    const buf = this.buffers.get(sessionId)
    if (buf) {
      // Cap events to prevent memory bloat
      if (buf.events.length >= MAX_EVENTS_PER_SESSION) {
        // Drop oldest 20% to make room
        buf.events = buf.events.slice(Math.floor(MAX_EVENTS_PER_SESSION * 0.2))
      }
      buf.events.push({ type, data, timestamp: Date.now() })
    }
  }

  /** Mark session as completed, auto-clean after TTL */
  end(sessionId: string): void {
    const buf = this.buffers.get(sessionId)
    if (buf) {
      buf.isActive = false
      setTimeout(() => {
        const current = this.buffers.get(sessionId)
        if (current && !current.isActive) {
          this.buffers.delete(sessionId)
        }
      }, BUFFER_TTL_MS)
    }
  }

  /** Clear buffer for a session */
  clear(sessionId: string): void {
    this.buffers.delete(sessionId)
  }

  /** Check if a session has an active CLI process */
  isActive(sessionId: string): boolean {
    return this.buffers.get(sessionId)?.isActive ?? false
  }

  /** Get all buffered events for replay */
  getEvents(sessionId: string): BufferedEvent[] {
    return this.buffers.get(sessionId)?.events ?? []
  }

  /** Get status for a session */
  getStatus(sessionId: string): { isActive: boolean; eventCount: number; startedAt: number | null } {
    const buf = this.buffers.get(sessionId)
    if (!buf) return { isActive: false, eventCount: 0, startedAt: null }
    return { isActive: buf.isActive, eventCount: buf.events.length, startedAt: buf.startedAt }
  }

  /** Remove stale buffers that have been around too long */
  private cleanupStale(): void {
    const now = Date.now()
    for (const [id, buf] of this.buffers) {
      // Remove inactive buffers past TTL
      if (!buf.isActive && now - buf.startedAt > BUFFER_TTL_MS * 2) {
        this.buffers.delete(id)
      }
      // Mark very old active buffers as inactive (stuck processes) but keep events for replay
      if (buf.isActive && now - buf.startedAt > MAX_BUFFER_AGE_MS) {
        buf.isActive = false
      }
    }
  }

  /** Total number of active buffers (for monitoring) */
  get size(): number {
    return this.buffers.size
  }
}

export const streamBuffer = new StreamBuffer()
