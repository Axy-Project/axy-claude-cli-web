import type { ChatMode } from '../constants'

// ─── Client -> Server Events ─────────────────────────────
export interface WsClientEvents {
  'chat:send': {
    sessionId: string
    content: string
    mode?: ChatMode
    agentId?: string
  }
  'chat:stop': {
    sessionId: string
  }
  'permission:respond': {
    requestId: string
    allowed: boolean
    remember?: boolean
  }
  'terminal:write': {
    terminalId: string
    data: string
  }
  'terminal:resize': {
    terminalId: string
    cols: number
    rows: number
  }
  'terminal:create': {
    projectId: string
  }
  'terminal:destroy': {
    terminalId: string
  }
}

// ─── Server -> Client Events ─────────────────────────────
export interface WsServerEvents {
  'claude:stream-chunk': {
    sessionId: string
    messageId: string
    chunk: StreamChunk
  }
  'claude:stream-end': {
    sessionId: string
    messageId: string
    usage: {
      inputTokens: number
      outputTokens: number
      costUsd: number
    }
  }
  'claude:stream-error': {
    sessionId: string
    error: string
  }
  'claude:tool-start': {
    sessionId: string
    toolName: string
    toolInput: Record<string, unknown>
  }
  'claude:tool-end': {
    sessionId: string
    toolName: string
    toolResult: string
    durationMs: number
  }
  'claude:thinking': {
    sessionId: string
    thinking: string
  }
  'permission:request': {
    requestId: string
    sessionId: string
    tool: string
    input: Record<string, unknown>
    description: string
  }
  'terminal:created': {
    terminalId: string
    projectId: string
  }
  'terminal:data': {
    terminalId: string
    data: string
  }
  'terminal:exit': {
    terminalId: string
    code: number
  }
  'agent:status': {
    agentId: string
    status: 'idle' | 'running' | 'error'
    progress?: string
  }
  'task:created': {
    task: import('./models').Task
  }
  'task:updated': {
    task: import('./models').Task
  }
  'task:completed': {
    task: import('./models').Task
  }
  'budget:warning': {
    type: 'daily' | 'monthly'
    currentSpend: number
    limit: number
    percentUsed: number
  }
  'deploy:status': {
    runId: string
    pipelineId: string
    pipelineName: string
    status: 'running' | 'success' | 'failed'
    branch: string
    filesUploaded?: number
    durationMs?: number
    error?: string
  }
}

export interface StreamChunk {
  type: 'text' | 'tool_use_start' | 'tool_use_end' | 'thinking' | 'content_block_stop'
  text?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  thinking?: string
}

/** Generic WebSocket message envelope */
export interface WsMessage<T = unknown> {
  type: string
  data: T
}

/** Type-safe WebSocket message creation */
export function createWsMessage<K extends keyof WsServerEvents>(
  type: K,
  data: WsServerEvents[K]
): WsMessage<WsServerEvents[K]> {
  return { type, data }
}
