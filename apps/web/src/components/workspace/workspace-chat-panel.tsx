'use client'

import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { wsClient } from '@/lib/ws-client'
import { api } from '@/lib/api-client'
import type { Session, Message, ContentBlock, ToolCall } from '@axy/shared'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Lightweight chat panel for the workspace IDE.
 * Reuses the global chat store + WS so streaming works the same as the full chat page.
 * For advanced features (orchestration, develop view, system prompt, loop mode),
 * users can switch to the full chat page via the "open full chat" button.
 */
export function WorkspaceChatPanel({
  sessionId,
  projectId,
}: {
  sessionId: string
  projectId: string
}) {
  const {
    messages,
    setSession,
    sendMessage,
    stopGeneration,
    fetchMessages,
  } = useChatStore()

  const isStreaming = useChatStore((s) => s._streams[sessionId]?.isStreaming || false)
  const streamingContent = useChatStore((s) => s._streams[sessionId]?.content || '')

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initialize session
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const session = await api.get<Session>(`/api/sessions/${sessionId}`)
        if (cancelled) return
        setSession(session)
        await fetchMessages(sessionId)
        wsClient.subscribeToSession(sessionId)
      } catch (e) {
        console.error('Failed to load session', e)
      }
    }
    init()
    return () => { cancelled = true }
  }, [sessionId, setSession, fetchMessages])

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, streamingContent])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || isStreaming) return
    setInput('')
    await sendMessage(sessionId, content)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-[11px] font-medium text-[var(--foreground)]">Claude Chat</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <svg className="h-2.5 w-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              streaming
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isStreaming && (
            <button
              onClick={() => stopGeneration(sessionId)}
              className="rounded p-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
              title="Stop"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
            </button>
          )}
          <a
            href={`/projects/${projectId}/chat/${sessionId}`}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-white/5 hover:text-[var(--foreground)]"
            title="Open full chat view"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex h-full items-center justify-center text-center">
            <div className="text-[11px] text-[var(--muted-foreground)]">
              <p className="mb-1">Send a message to start.</p>
              <p>Claude has full access to this project's files.</p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageItem key={m.id} message={m} />
        ))}

        {isStreaming && streamingContent && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">claude</div>
            <div className="prose prose-invert prose-sm max-w-none text-[12px] leading-relaxed text-[var(--foreground)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border)] p-2">
        <div className="flex items-end gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-low)] p-2 focus-within:border-[var(--primary)]/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask Claude..."
            rows={2}
            className="flex-1 resize-none bg-transparent text-[12px] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="rounded-md bg-[var(--primary)]/20 p-1.5 text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/30 disabled:opacity-30"
            title="Send (Cmd/Ctrl+Enter)"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div className="mt-1 text-[9px] text-[var(--muted-foreground)]">
          Cmd/Ctrl+Enter to send · open full chat for orchestration, system prompt, loop mode
        </div>
      </div>
    </div>
  )
}

function MessageItem({ message }: { message: Message }) {
  const text = message.contentJson
    ?.filter((b: ContentBlock) => b.type === 'text')
    .map((b: ContentBlock) => b.text)
    .join('\n') || ''

  const toolCalls = message.contentJson?.filter((b: ContentBlock) => b.type === 'tool_use') as ToolCall[] | undefined

  const isUser = message.role === 'user'

  return (
    <div className="mb-3">
      <div
        className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${
          isUser ? 'text-[var(--tertiary)]' : 'text-[var(--primary)]'
        }`}
      >
        {isUser ? 'you' : 'claude'}
      </div>
      {toolCalls && toolCalls.length > 0 && (
        <div className="mb-1.5 space-y-1">
          {toolCalls.map((tc) => (
            <div
              key={tc.id}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface-low)] px-1.5 py-1 text-[10px] text-[var(--muted-foreground)]"
            >
              <svg className="h-2.5 w-2.5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
              <span className="font-mono">{tc.name}</span>
            </div>
          ))}
        </div>
      )}
      {text && (
        <div className="prose prose-invert prose-sm max-w-none text-[12px] leading-relaxed text-[var(--foreground)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
