import { create } from 'zustand'
import { wsClient } from '@/lib/ws-client'

export interface PermissionRequest {
  requestId: string
  sessionId: string
  tool: string
  input: Record<string, unknown>
  description?: string
}

interface PermissionState {
  /** Queue of pending permission requests */
  queue: PermissionRequest[]

  /** The currently displayed request (first in queue) */
  currentRequest: PermissionRequest | null

  /** Add a new permission request to the queue */
  addRequest: (request: PermissionRequest) => void

  /** Respond to the current request and advance the queue */
  respond: (requestId: string, allowed: boolean, remember?: boolean) => void

  /** Initialize WebSocket listeners; returns cleanup function */
  initWsListeners: () => () => void

  /** Reset state */
  reset: () => void
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  queue: [],
  currentRequest: null,

  addRequest: (request) => {
    set((state) => {
      const newQueue = [...state.queue, request]
      return {
        queue: newQueue,
        currentRequest: state.currentRequest ?? request,
      }
    })
  },

  respond: (requestId, allowed, remember) => {
    // Send response via WebSocket
    wsClient.send('permission:respond', { requestId, allowed, remember })

    set((state) => {
      const newQueue = state.queue.filter((r) => r.requestId !== requestId)
      return {
        queue: newQueue,
        currentRequest: newQueue.length > 0 ? newQueue[0] : null,
      }
    })
  },

  initWsListeners: () => {
    const unsub = wsClient.on('permission:request' as any, (data: any) => {
      get().addRequest(data as PermissionRequest)
    })

    return () => unsub()
  },

  reset: () => {
    set({ queue: [], currentRequest: null })
  },
}))
