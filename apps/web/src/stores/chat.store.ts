import { create } from 'zustand'
import type { Message, Session, ContentBlock } from '@axy/shared'
import { uuid } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { wsClient } from '@/lib/ws-client'
import { notifications } from '@/lib/notifications'

export interface StreamingToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  error?: string
  isRunning: boolean
  startedAt: number
  durationMs?: number
}

/** Per-session streaming state */
interface SessionStreamState {
  isStreaming: boolean
  content: string
  thinking: string
  toolCalls: StreamingToolCall[]
  thinkingStartedAt: number | null
}

function emptyStreamState(): SessionStreamState {
  return {
    isStreaming: false,
    content: '',
    thinking: '',
    toolCalls: [],
    thinkingStartedAt: null,
  }
}

export interface BudgetWarning {
  type: 'daily' | 'monthly'
  currentSpend: number
  limit: number
  percentUsed: number
}

interface ChatState {
  currentSession: Session | null
  messages: Message[]

  /** Per-session streaming state, keyed by sessionId */
  _streams: Record<string, SessionStreamState>

  // Current session's streaming state (derived from _streams + currentSession)
  isStreaming: boolean
  streamingContent: string
  streamingThinking: string
  streamingToolCalls: StreamingToolCall[]
  thinkingStartedAt: number | null

  /** Whether more older messages can be loaded (pagination) */
  hasMore: boolean

  /** Budget warning received from server */
  budgetWarning: BudgetWarning | null
  dismissBudgetWarning: () => void

  /** Per-session message queue size (from server) */
  queueSizes: Record<string, number>

  setSession: (session: Session) => void
  updateSessionModel: (sessionId: string, model: string) => Promise<void>
  fetchMessages: (sessionId: string) => Promise<void>
  fetchMoreMessages: (sessionId: string) => Promise<void>
  branchSession: (sessionId: string, fromMessageId: string) => Promise<Session>
  sendMessage: (sessionId: string, content: string, agentId?: string, images?: { data: string; mimeType: string; name?: string }[], mode?: string, effort?: string) => Promise<void>
  sendBtw: (sessionId: string, message: string) => Promise<boolean>
  stopGeneration: (sessionId: string) => Promise<void>
  checkAndReplayStream: (sessionId: string) => Promise<void>
  initWsListeners: () => () => void
  reset: () => void
}

/** Derive visible streaming state from per-session map */
function deriveStreamState(streams: Record<string, SessionStreamState>, sessionId: string | undefined) {
  const s = sessionId ? streams[sessionId] : undefined
  return {
    isStreaming: s?.isStreaming ?? false,
    streamingContent: s?.content ?? '',
    streamingThinking: s?.thinking ?? '',
    streamingToolCalls: s?.toolCalls ?? [],
    thinkingStartedAt: s?.thinkingStartedAt ?? null,
  }
}

/** Helper: update streaming state for a specific session, returning new _streams + derived state */
function patchStream(
  state: ChatState,
  sessionId: string,
  updater: (s: SessionStreamState) => Partial<SessionStreamState>
) {
  const current = state._streams[sessionId] || emptyStreamState()
  const updated = { ...current, ...updater(current) }
  const newStreams = { ...state._streams, [sessionId]: updated }
  return {
    _streams: newStreams,
    ...deriveStreamState(newStreams, state.currentSession?.id),
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentSession: null,
  messages: [],
  _streams: {},
  isStreaming: false,
  streamingContent: '',
  streamingThinking: '',
  streamingToolCalls: [],
  thinkingStartedAt: null,
  hasMore: false,
  budgetWarning: null,
  queueSizes: {},

  dismissBudgetWarning: () => set({ budgetWarning: null }),

  setSession: (session) => {
    const state = get()
    // Derive streaming state for the NEW session
    const derived = deriveStreamState(state._streams, session.id)
    set({ currentSession: session, ...derived })
  },

  updateSessionModel: async (sessionId, model) => {
    const updated = await api.patch<Session>(`/api/sessions/${sessionId}`, { model })
    set({ currentSession: updated })
  },

  branchSession: async (sessionId, fromMessageId) => {
    const newSession = await api.post<Session>(`/api/sessions/${sessionId}/branch`, { fromMessageId })
    return newSession
  },

  reset: () => {
    set({
      currentSession: null,
      messages: [],
      _streams: {},
      isStreaming: false,
      streamingContent: '',
      streamingThinking: '',
      streamingToolCalls: [],
      thinkingStartedAt: null,
      hasMore: false,
      budgetWarning: null,
      queueSizes: {},
    })
  },

  fetchMessages: async (sessionId) => {
    const res = await api.get<{ messages: Message[]; hasMore: boolean }>(`/api/sessions/${sessionId}/messages?limit=50`)
    if (get().currentSession?.id === sessionId) {
      set({ messages: res.messages, hasMore: res.hasMore })
    }
  },

  fetchMoreMessages: async (sessionId) => {
    const state = get()
    if (!state.hasMore || state.currentSession?.id !== sessionId) return
    const oldestMessage = state.messages[0]
    if (!oldestMessage) return

    const res = await api.get<{ messages: Message[]; hasMore: boolean }>(
      `/api/sessions/${sessionId}/messages?limit=50&before=${oldestMessage.id}`
    )
    if (get().currentSession?.id === sessionId) {
      set((s) => ({
        messages: [...res.messages, ...s.messages],
        hasMore: res.hasMore,
      }))
    }
  },

  sendMessage: async (sessionId, content, agentId?, images?, mode?, effort?) => {
    // Set streaming state for THIS session (only if not already streaming —
    // if already streaming, server will queue the message)
    set((state) => {
      const current = state._streams[sessionId] || emptyStreamState()
      if (current.isStreaming) return {} // Already streaming — server will queue
      return patchStream(state, sessionId, () => ({
        isStreaming: true,
        content: '',
        thinking: '',
        toolCalls: [],
        thinkingStartedAt: null,
      }))
    })

    // Optimistically add user message (only if viewing this session)
    const contentBlocks: ContentBlock[] = [
      { type: 'text', text: content },
    ]
    if (images?.length) {
      for (const img of images) {
        contentBlocks.push({ type: 'image', mimeType: img.mimeType })
      }
    }

    const userMessage: Message = {
      id: uuid(),
      sessionId,
      role: 'user',
      contentJson: contentBlocks,
      createdAt: new Date().toISOString(),
    }

    if (get().currentSession?.id === sessionId) {
      set((state) => ({ messages: [...state.messages, userMessage] }))
    }

    // Subscribe to session events
    wsClient.subscribeToSession(sessionId)

    // Send via REST (triggers WebSocket streaming)
    try {
      await api.post('/api/chat/send', { sessionId, content, agentId, images, mode, effort })
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to send message'
      const errorMessage: Message = {
        id: uuid(),
        sessionId,
        role: 'assistant',
        contentJson: [{ type: 'text', text: `**Error:** ${error}` }],
        createdAt: new Date().toISOString(),
      }

      set((state) => ({
        messages: state.currentSession?.id === sessionId
          ? [...state.messages, errorMessage]
          : state.messages,
        ...patchStream(state, sessionId, () => emptyStreamState()),
      }))
    }
  },

  sendBtw: async (sessionId, message) => {
    try {
      await api.post('/api/chat/btw', { sessionId, message })
      // Add a visual indicator in the chat as a user message tagged as btw
      const btwMessage: Message = {
        id: uuid(),
        sessionId,
        role: 'user',
        contentJson: [{ type: 'text', text: `💬 **BTW:** ${message}` }],
        createdAt: new Date().toISOString(),
      }
      if (get().currentSession?.id === sessionId) {
        set((state) => ({ messages: [...state.messages, btwMessage] }))
      }
      return true
    } catch {
      return false
    }
  },

  stopGeneration: async (sessionId) => {
    await api.post('/api/chat/stop', { sessionId })
    set((state) => ({
      ...patchStream(state, sessionId, () => ({ isStreaming: false })),
      queueSizes: { ...state.queueSizes, [sessionId]: 0 },
    }))
  },

  checkAndReplayStream: async (sessionId) => {
    try {
      const res = await api.get<{
        isActive: boolean
        eventCount: number
        events: { type: string; data: Record<string, unknown> }[]
      }>(`/api/sessions/${sessionId}/stream-status`)

      if (!res || res.eventCount === 0) return

      // If the stream already completed, just re-fetch messages from DB
      const hasEnded = res.events.some(
        (e) => e.type === 'claude:stream-end' || e.type === 'claude:stream-error'
      )
      if (hasEnded) {
        await get().fetchMessages(sessionId)
        return
      }

      // Rebuild state from ALL buffered events (always replay, WS live events will
      // continue appending on top - this eliminates the race condition where the
      // old code would skip replay if WS handlers already set isStreaming=true)
      let content = ''
      let thinking = ''
      const toolCalls: StreamingToolCall[] = []
      let thinkingStartedAt: number | null = null

      for (const evt of res.events) {
        const data = evt.data as Record<string, unknown>
        switch (evt.type) {
          case 'claude:stream-chunk': {
            const chunk = data.chunk as Record<string, unknown>
            if (chunk?.type === 'text' && chunk.text) {
              content += chunk.text as string
            } else if (chunk?.type === 'thinking' && chunk.thinking) {
              thinking += chunk.thinking as string
              thinkingStartedAt = thinkingStartedAt ?? Date.now()
            } else if (chunk?.type === 'tool_use_start' && chunk.toolName) {
              toolCalls.push({
                id: uuid(),
                name: chunk.toolName as string,
                input: (chunk.toolInput as Record<string, unknown>) || {},
                isRunning: true,
                startedAt: Date.now(),
              })
            } else if (chunk?.type === 'tool_use_end') {
              const last = [...toolCalls].reverse().find((c) => c.isRunning)
              if (last) {
                last.isRunning = false
                last.result = (chunk.toolResult as string) || undefined
              }
            }
            break
          }
          case 'claude:tool-start': {
            toolCalls.push({
              id: uuid(),
              name: data.toolName as string,
              input: (data.toolInput as Record<string, unknown>) || {},
              isRunning: true,
              startedAt: Date.now(),
            })
            break
          }
          case 'claude:tool-end': {
            const match = [...toolCalls].reverse().find(
              (c) => c.name === data.toolName && c.isRunning
            )
            if (match) {
              match.isRunning = false
              match.durationMs = data.durationMs as number
              match.result = data.toolResult as string
            }
            break
          }
          case 'claude:thinking': {
            thinking += data.thinking as string
            thinkingStartedAt = thinkingStartedAt ?? Date.now()
            break
          }
        }
      }

      // Apply the rebuilt state - set streaming=true if the process is active,
      // or if we have content (process may have just finished between our check)
      if (res.isActive || content || thinking || toolCalls.length > 0) {
        set((state) => patchStream(state, sessionId, () => ({
          isStreaming: res.isActive,
          content,
          thinking,
          toolCalls,
          thinkingStartedAt,
        })))

        // If not active but had content, refetch messages to get the final saved version
        if (!res.isActive) {
          await get().fetchMessages(sessionId)
        }
      }
    } catch {
      // Ignore - stream status endpoint not available
    }
  },

  initWsListeners: () => {
    const unsubs = [
      // Text and thinking stream chunks
      wsClient.on('claude:stream-chunk', (data) => {
        const { sessionId, chunk } = data
        if (chunk.type === 'text' && chunk.text) {
          set((state) => patchStream(state, sessionId, (s) => ({
            content: s.content + chunk.text,
          })))
        } else if (chunk.type === 'thinking' && chunk.thinking) {
          set((state) => patchStream(state, sessionId, (s) => ({
            thinking: s.thinking + chunk.thinking,
            thinkingStartedAt: s.thinkingStartedAt ?? Date.now(),
          })))
        } else if (chunk.type === 'tool_use_start' && chunk.toolName) {
          set((state) => patchStream(state, sessionId, (s) => ({
            toolCalls: [
              ...s.toolCalls,
              {
                id: uuid(),
                name: chunk.toolName!,
                input: chunk.toolInput || {},
                isRunning: true,
                startedAt: Date.now(),
              },
            ],
          })))
        } else if (chunk.type === 'tool_use_end') {
          set((state) => patchStream(state, sessionId, (s) => {
            const calls = [...s.toolCalls]
            const lastRunning = [...calls].reverse().find((c) => c.isRunning)
            if (lastRunning) {
              lastRunning.isRunning = false
              lastRunning.durationMs = Date.now() - lastRunning.startedAt
              lastRunning.result = chunk.toolResult || undefined
            }
            return { toolCalls: calls }
          }))
        }
      }),

      // Dedicated tool-start event
      wsClient.on('claude:tool-start', (data) => {
        const { sessionId } = data
        set((state) => patchStream(state, sessionId, (s) => ({
          toolCalls: [
            ...s.toolCalls,
            {
              id: uuid(),
              name: data.toolName,
              input: data.toolInput || {},
              isRunning: true,
              startedAt: Date.now(),
            },
          ],
        })))
      }),

      // Dedicated tool-end event
      wsClient.on('claude:tool-end', (data) => {
        const { sessionId } = data
        set((state) => patchStream(state, sessionId, (s) => {
          const calls = [...s.toolCalls]
          const match = [...calls].reverse().find(
            (c) => c.name === data.toolName && c.isRunning
          )
          if (match) {
            match.isRunning = false
            match.durationMs = data.durationMs
            match.result = data.toolResult
          }
          return { toolCalls: calls }
        }))
      }),

      // Dedicated thinking event
      wsClient.on('claude:thinking', (data) => {
        const { sessionId } = data
        set((state) => patchStream(state, sessionId, (s) => ({
          thinking: s.thinking + data.thinking,
          thinkingStartedAt: s.thinkingStartedAt ?? Date.now(),
        })))
      }),

      // Stream end - assemble final message
      wsClient.on('claude:stream-end', (data) => {
        const { sessionId } = data
        const state = get()
        const stream = state._streams[sessionId] || emptyStreamState()

        const contentJson: ContentBlock[] = []

        if (stream.thinking) {
          contentJson.push({ type: 'thinking', thinking: stream.thinking })
        }
        if (stream.content) {
          contentJson.push({ type: 'text', text: stream.content })
        }
        for (const tc of stream.toolCalls) {
          contentJson.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
          if (tc.result !== undefined) {
            contentJson.push({ type: 'tool_result', content: tc.result })
          }
        }

        const thinkingDuration = stream.thinkingStartedAt
          ? Date.now() - stream.thinkingStartedAt
          : undefined

        const assistantMessage: Message = {
          id: data.messageId,
          sessionId,
          role: 'assistant',
          contentJson,
          inputTokens: data.usage.inputTokens,
          outputTokens: data.usage.outputTokens,
          costUsd: data.usage.costUsd,
          durationMs: thinkingDuration,
          toolCallsJson: stream.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            input: tc.input,
            result: tc.result,
            error: tc.error,
            durationMs: tc.durationMs,
          })),
          thinkingJson: stream.thinking
            ? [{ thinking: stream.thinking, durationMs: thinkingDuration }]
            : undefined,
          createdAt: new Date().toISOString(),
        }

        const isViewing = state.currentSession?.id === sessionId

        // Notify user if page is in background
        notifications.notifyChatReady(state.currentSession?.title)

        // Clear this session's streaming state
        const newStreams = { ...state._streams }
        delete newStreams[sessionId]

        set((prev) => ({
          messages: isViewing ? [...prev.messages, assistantMessage] : prev.messages,
          _streams: newStreams,
          ...deriveStreamState(newStreams, prev.currentSession?.id),
        }))
      }),

      // Budget warning
      wsClient.on('budget:warning', (data) => {
        set({ budgetWarning: data })
      }),

      // Queue update
      wsClient.on('claude:queue-update', (data) => {
        const { sessionId, queueSize } = data
        set((state) => ({
          queueSizes: { ...state.queueSizes, [sessionId]: queueSize },
        }))
      }),

      // Stream error
      wsClient.on('claude:stream-error', (data) => {
        const { sessionId } = data
        console.error('[Chat] Stream error:', data.error)

        const errorMessage: Message = {
          id: uuid(),
          sessionId,
          role: 'assistant',
          contentJson: [{ type: 'text', text: `**Error:** ${data.error}` }],
          createdAt: new Date().toISOString(),
        }

        const state = get()
        const isViewing = state.currentSession?.id === sessionId

        const newStreams = { ...state._streams }
        delete newStreams[sessionId]

        set((prev) => ({
          messages: isViewing ? [...prev.messages, errorMessage] : prev.messages,
          _streams: newStreams,
          ...deriveStreamState(newStreams, prev.currentSession?.id),
        }))
      }),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  },
}))
