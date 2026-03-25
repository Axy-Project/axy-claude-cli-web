'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { useMultiChatStore } from '@/stores/multichat.store'
import { GripVertical, X, Columns2, Terminal } from 'lucide-react'
import { api } from '@/lib/api-client'
import { wsClient } from '@/lib/ws-client'
import { uuid, formatTokens } from '@/lib/utils'
import type { Session, Message, ContentBlock } from '@axy/shared'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MultiChatPanelProps {
  projectId: string
  primarySessionId: string
  children: React.ReactNode
}

/**
 * MultiChat wraps the primary chat and optionally shows a secondary session
 * in a resizable split view. Desktop only — renders just children on mobile.
 */
export function MultiChatPanel({ projectId, primarySessionId, children }: MultiChatPanelProps) {
  const { isActive, secondarySessionId, splitRatio, disable, setSplitRatio } = useMultiChatStore()
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      isDragging.current = true
      const startX = e.clientX
      const startRatio = splitRatio

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const delta = ev.clientX - startX
        const deltaPercent = (delta / rect.width) * 100
        setSplitRatio(Math.max(25, Math.min(75, startRatio + deltaPercent)))
      }

      const onMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [splitRatio, setSplitRatio]
  )

  if (!isActive || !secondarySessionId) {
    return <>{children}</>
  }

  return (
    <div ref={containerRef} className="flex h-full" style={{ display: 'flex' }}>
      {/* Primary chat (left) */}
      <div className="min-w-0 overflow-hidden" style={{ width: `${splitRatio}%`, flexShrink: 0 }}>
        {children}
      </div>

      {/* Drag handle — wide hit area */}
      <div
        onMouseDown={handleMouseDown}
        className="group relative z-10 flex shrink-0 cursor-col-resize items-center justify-center"
        style={{ width: '8px' }}
      >
        <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[rgba(72,72,71,0.3)] transition-colors group-hover:bg-[#bd9dff]/60" />
        <GripVertical className="relative h-5 w-5 text-[#767575] opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Secondary panel (right) */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <SecondaryPanel
          projectId={projectId}
          sessionId={secondarySessionId}
          onClose={disable}
        />
      </div>
    </div>
  )
}

type PanelView = 'chat' | 'terminal'

function SecondaryPanel({
  projectId,
  sessionId,
  onClose,
}: {
  projectId: string
  sessionId: string
  onClose: () => void
}) {
  const [view, setView] = useState<PanelView>('chat')
  const [session, setSession] = useState<Session | null>(null)
  const [TerminalComponent, setTerminalComponent] = useState<React.ComponentType<{ projectId: string }> | null>(null)

  useEffect(() => {
    api.get<Session>(`/api/sessions/${sessionId}`).then(setSession).catch(() => {})
  }, [sessionId])

  useEffect(() => {
    if (view === 'terminal' && !TerminalComponent) {
      import('@/components/terminal/embedded-terminal').then((mod) =>
        setTerminalComponent(() => mod.EmbeddedTerminal)
      )
    }
  }, [view, TerminalComponent])

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Header tabs */}
      <div className="flex shrink-0 items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('chat')}
            className={`flex items-center gap-1.5 rounded-[0.375rem] px-2.5 py-1 text-xs font-medium transition-colors ${
              view === 'chat' ? 'bg-[#bd9dff]/10 text-[#bd9dff]' : 'text-[#adaaaa] hover:text-white'
            }`}
          >
            <Columns2 className="h-3 w-3" />
            <span className="max-w-[140px] truncate">{session?.title || 'Chat'}</span>
          </button>
          <button
            onClick={() => setView('terminal')}
            className={`flex items-center gap-1.5 rounded-[0.375rem] px-2.5 py-1 text-xs font-medium transition-colors ${
              view === 'terminal' ? 'bg-[#bd9dff]/10 text-[#bd9dff]' : 'text-[#adaaaa] hover:text-white'
            }`}
          >
            <Terminal className="h-3 w-3" />
            Terminal
          </button>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-white"
          title="Close split view"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'chat' && (
          <SecondaryChatView projectId={projectId} sessionId={sessionId} session={session} />
        )}
        {view === 'terminal' && (
          <div className="h-full">
            {TerminalComponent ? (
              <TerminalComponent projectId={projectId} />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[#767575]">Loading terminal...</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Native secondary chat — matches primary chat styling
// ────────────────────────────────────────────────────────────

interface StreamState {
  isStreaming: boolean
  content: string
  thinking: string
}

function SecondaryChatView({
  sessionId,
}: {
  projectId: string
  sessionId: string
  session: Session | null
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [stream, setStream] = useState<StreamState>({ isStreaming: false, content: '', thinking: '' })
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load messages + subscribe to WS
  useEffect(() => {
    let cancelled = false
    wsClient.subscribeToSession(sessionId)

    api.get<{ messages: Message[]; hasMore: boolean }>(`/api/sessions/${sessionId}/messages?limit=50`)
      .then((res) => { if (!cancelled) setMessages(res.messages) })
      .catch(() => {})

    api.get<{ isActive: boolean }>(`/api/sessions/${sessionId}/stream-status`)
      .then((res) => { if (!cancelled && res.isActive) setStream((s) => ({ ...s, isStreaming: true })) })
      .catch(() => {})

    return () => {
      cancelled = true
      wsClient.unsubscribeFromSession(sessionId)
    }
  }, [sessionId])

  // WS listeners
  useEffect(() => {
    const unsubs = [
      wsClient.on('claude:stream-chunk', (data) => {
        if (data.sessionId !== sessionId) return
        if (data.chunk.type === 'text' && data.chunk.text) {
          setStream((s) => ({ ...s, isStreaming: true, content: s.content + data.chunk.text }))
        } else if (data.chunk.type === 'thinking' && data.chunk.thinking) {
          setStream((s) => ({ ...s, isStreaming: true, thinking: s.thinking + data.chunk.thinking }))
        }
      }),
      wsClient.on('claude:stream-end', (data) => {
        if (data.sessionId !== sessionId) return
        const contentJson: ContentBlock[] = []
        setStream((prev) => {
          if (prev.thinking) contentJson.push({ type: 'thinking', thinking: prev.thinking })
          if (prev.content) contentJson.push({ type: 'text', text: prev.content })
          const assistantMsg: Message = {
            id: data.messageId,
            sessionId,
            role: 'assistant',
            contentJson,
            inputTokens: data.usage.inputTokens,
            outputTokens: data.usage.outputTokens,
            costUsd: data.usage.costUsd,
            createdAt: new Date().toISOString(),
          }
          setMessages((msgs) => [...msgs, assistantMsg])
          return { isStreaming: false, content: '', thinking: '' }
        })
      }),
      wsClient.on('claude:stream-error', (data) => {
        if (data.sessionId !== sessionId) return
        const errorMsg: Message = {
          id: uuid(),
          sessionId,
          role: 'assistant',
          contentJson: [{ type: 'text', text: `**Error:** ${data.error}` }],
          createdAt: new Date().toISOString(),
        }
        setMessages((msgs) => [...msgs, errorMsg])
        setStream({ isStreaming: false, content: '', thinking: '' })
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [sessionId])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, stream.content])

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content) return
    setInput('')

    const userMsg: Message = {
      id: uuid(),
      sessionId,
      role: 'user',
      contentJson: [{ type: 'text', text: content }],
      createdAt: new Date().toISOString(),
    }
    setMessages((msgs) => [...msgs, userMsg])
    setStream({ isStreaming: true, content: '', thinking: '' })

    try {
      await api.post('/api/chat/send', { sessionId, content })
    } catch (err) {
      const errorMsg: Message = {
        id: uuid(),
        sessionId,
        role: 'assistant',
        contentJson: [{ type: 'text', text: `**Error:** ${err instanceof Error ? err.message : 'Failed to send'}` }],
        createdAt: new Date().toISOString(),
      }
      setMessages((msgs) => [...msgs, errorMsg])
      setStream({ isStreaming: false, content: '', thinking: '' })
    }
  }, [input, sessionId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-2 md:px-6">
        {messages.length === 0 && !stream.isStreaming && (
          <div className="flex h-full items-center justify-center text-sm text-[#767575]">
            No messages yet
          </div>
        )}
        {messages.map((msg) => (
          <MessageView key={msg.id} msg={msg} />
        ))}

        {/* Streaming */}
        {stream.isStreaming && (stream.content || stream.thinking) && (
          <div className="py-5" style={{ borderTop: '1px solid rgba(72,72,71,0.08)' }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#3bfb8c]" />
              <span className="font-label text-[10px] font-semibold uppercase tracking-[0.15em] text-[#767575]">
                CLAUDE
                <span className="ml-2">
                  <svg className="inline h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </span>
              </span>
            </div>
            <div className="rounded-[0.75rem] px-5 py-4" style={{ background: 'rgba(19,19,19,0.6)', border: '1px solid rgba(72,72,71,0.12)', borderLeft: '3px solid rgba(59,251,140,0.25)' }}>
              {stream.thinking && (
                <div className="mb-3 rounded border border-purple-500/10 bg-purple-500/5 px-3 py-2">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-purple-300/70">
                    {stream.thinking.slice(-800)}
                  </pre>
                </div>
              )}
              {stream.content && (
                <div className="prose prose-base dark:prose-invert max-w-none overflow-hidden break-words prose-p:text-[15px] prose-p:leading-[1.7] prose-p:text-[#e0e0e0] prose-strong:text-white prose-a:text-[#bd9dff] prose-code:rounded prose-code:bg-[#1a1a1a] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:text-[#bd9dff] prose-pre:my-4 prose-pre:overflow-hidden prose-pre:rounded-[0.75rem] prose-pre:bg-[#0e0e0e]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{stream.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
        {stream.isStreaming && !stream.content && !stream.thinking && (
          <div className="py-5" style={{ borderTop: '1px solid rgba(72,72,71,0.08)' }}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#3bfb8c]" />
              <span className="font-label text-[10px] font-semibold uppercase tracking-[0.15em] text-[#767575]">CLAUDE</span>
              <svg className="h-3 w-3 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-[11px] text-amber-400">streaming</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area — matches primary chat input style */}
      <div className="shrink-0 px-4 pb-3 pt-2 md:px-6">
        <div className="flex items-center gap-2 rounded-[0.75rem] px-3 py-2.5 md:gap-3 md:px-4 md:py-3" style={{ background: 'rgba(26,26,26,0.6)', border: '1px solid rgba(189,157,255,0.15)', backdropFilter: 'blur(20px)' }}>
          <span className="hidden shrink-0 font-mono text-lg font-bold text-[#bd9dff] md:inline">&#10095;</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or message..."
            rows={1}
            className="w-full resize-none border-none bg-transparent px-0 py-1 text-[15px] text-white outline-none ring-0 placeholder:text-[#767575]/70 focus:border-none focus:outline-none focus:ring-0"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.625rem] transition-all hover:brightness-110 disabled:opacity-25 md:h-12 md:w-12"
            style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="#2a0066" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
        <div className="mt-1.5 px-1 text-[11px] text-[#767575]/60">
          {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? 'CMD' : 'CTRL'} + ENTER to send
        </div>
      </div>
    </div>
  )
}

/**
 * Message view — matches the primary chat's UserMessageView / AssistantMessageView styling.
 */
function MessageView({ msg }: { msg: Message }) {
  const blocks = msg.contentJson || []
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (msg.role === 'user') {
    const text = blocks.find((b) => b.type === 'text')?.text || ''
    return (
      <div className="py-5" style={{ borderTop: '1px solid rgba(72,72,71,0.08)' }}>
        <div className="mb-3 text-right">
          <span className="font-label text-[10px] font-semibold uppercase tracking-[0.15em] text-[#767575]">
            USER // LOCALHOST
            <span className="ml-1">&#8226;</span>
            <span className="ml-1">{time}</span>
          </span>
        </div>
        <div className="overflow-hidden rounded-[0.75rem] px-4 py-4 md:px-7 md:py-6" style={{ background: 'rgba(26,26,26,0.6)', border: '1px solid rgba(72,72,71,0.12)', borderLeft: '3px solid rgba(189,157,255,0.3)' }}>
          <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.7] text-[#e0e0e0] md:text-[16px]">
            {text}
          </pre>
        </div>
      </div>
    )
  }

  // Assistant
  const textBlocks = blocks.filter((b) => b.type === 'text').map((b) => b.text || '')
  const thinkingBlocks = blocks.filter((b) => b.type === 'thinking')
  const toolCount = blocks.filter((b) => b.type === 'tool_use').length
  const modelLabel = msg.model?.replace('claude-', '').replace(/-\d+$/, '').toUpperCase() || 'CLAUDE'

  return (
    <div className="py-5" style={{ borderTop: '1px solid rgba(72,72,71,0.08)' }}>
      {/* Label */}
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#3bfb8c]" />
        <span className="font-label text-[10px] font-semibold uppercase tracking-[0.15em] text-[#767575]">
          CLAUDE // {modelLabel}
          <span className="ml-2">{time}</span>
        </span>
      </div>

      {/* Message content */}
      <div className="rounded-[0.75rem] px-5 py-4 md:px-7 md:py-6" style={{ background: 'rgba(19,19,19,0.6)', border: '1px solid rgba(72,72,71,0.12)', borderLeft: '3px solid rgba(59,251,140,0.25)' }}>
        {/* Thinking */}
        {thinkingBlocks.map((tb, i) => (
          <div key={`t-${i}`} className="mb-3">
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
                <svg className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="flex items-center gap-1.5 text-purple-400">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 01-6.364-2.637A5 5 0 018.464 6.1a5.002 5.002 0 017.072 0 5 5 0 01-1.172 7.265" />
                  </svg>
                  Thinking
                </span>
              </summary>
              <div className="ml-6 mt-1.5 rounded border border-purple-500/10 bg-purple-500/5 px-3 py-2">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-purple-300/70">
                  {tb.thinking}
                </pre>
              </div>
            </details>
          </div>
        ))}

        {/* Tool calls */}
        {toolCount > 0 && (
          <div className="mb-3 rounded-[0.5rem] px-3 py-2 text-[11px] text-[#adaaaa]" style={{ background: 'rgba(26,26,26,0.4)', border: '1px solid rgba(72,72,71,0.12)' }}>
            <span className="mr-1.5 text-amber-400">&#9881;</span>
            {toolCount} tool{toolCount > 1 ? 's' : ''} executed
          </div>
        )}

        {/* Text content */}
        {textBlocks.length > 0 ? (
          textBlocks.map((text, i) => (
            <div key={`txt-${i}`} className="mb-3">
              <div className="prose prose-base dark:prose-invert max-w-none overflow-hidden break-words prose-headings:font-semibold prose-headings:text-[#bd9dff] prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-[15px] prose-p:leading-[1.7] prose-p:text-[#e0e0e0] prose-strong:text-white prose-em:text-[#adaaaa] prose-a:text-[#bd9dff] prose-a:underline prose-li:text-[15px] prose-li:leading-[1.7] prose-li:text-[#e0e0e0] prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-pre:my-4 prose-pre:overflow-hidden prose-pre:rounded-[0.75rem] prose-pre:bg-[#0e0e0e] prose-pre:p-0 prose-code:rounded prose-code:bg-[#1a1a1a] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:text-[#bd9dff] prose-blockquote:border-[#bd9dff]/30 prose-blockquote:text-[#adaaaa]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              </div>
            </div>
          ))
        ) : toolCount > 0 ? (
          <p className="text-xs italic text-[#adaaaa]/60">
            Executed {toolCount} tool{toolCount > 1 ? 's' : ''}
          </p>
        ) : null}
      </div>

      {/* Token usage footer */}
      {(msg.inputTokens !== undefined || msg.outputTokens !== undefined) && (
        <div className="mt-2 flex items-center gap-3 pl-1 font-label text-[10px] text-[#adaaaa]/60">
          {msg.inputTokens !== undefined && (
            <span>{formatTokens(msg.inputTokens)} input</span>
          )}
          {msg.outputTokens !== undefined && (
            <span>{formatTokens(msg.outputTokens)} output</span>
          )}
        </div>
      )}
    </div>
  )
}
