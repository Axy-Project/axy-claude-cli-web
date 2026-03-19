'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Message, ContentBlock, ToolCall } from '@axy/shared'
import { formatTokens, formatCost } from '@/lib/utils'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
export interface SessionPlaybackProps {
  messages: Message[]
  onClose: () => void
}

type PlaybackSpeed = 1 | 2 | 4

// ────────────────────────────────────────────────────────────
// Collapsible (local, simplified)
// ────────────────────────────────────────────────────────────
function Collapsible({
  header,
  children,
}: {
  header: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {header}
      </button>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Tool Call Card
// ────────────────────────────────────────────────────────────
function PlaybackToolCall({ block, richTool }: { block: ContentBlock; richTool?: ToolCall }) {
  const name = richTool?.name ?? block.name ?? 'tool'
  const input = richTool?.input ?? block.input
  const result = richTool?.result ?? block.content
  const error = richTool?.error
  const durationMs = richTool?.durationMs

  const truncatedArgs = input
    ? JSON.stringify(input).slice(0, 120) + (JSON.stringify(input).length > 120 ? '...' : '')
    : null

  return (
    <div className="mb-2 rounded border border-[var(--border)] bg-[var(--secondary)]/50 overflow-hidden animate-[playback-expand_0.3s_ease-out]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/20 text-blue-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384-3.19A.75.75 0 005 12.638v-1.276a.75.75 0 011.036-.658l5.384 3.19a.75.75 0 010 1.276zM15.953 4.39l-5.384 3.19a.75.75 0 000 1.276l5.384 3.19A.75.75 0 0017 11.362V5.048a.75.75 0 00-1.047-.658z" />
          </svg>
        </span>
        <span className="rounded bg-blue-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-blue-400">
          {name}
        </span>
        {durationMs !== undefined && (
          <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">
            {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
          </span>
        )}
      </div>
      {truncatedArgs && (
        <div className="px-3 py-1.5">
          <Collapsible
            header={
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Input
              </span>
            }
          >
            <pre className="mt-1 max-h-32 overflow-auto font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              {JSON.stringify(input, null, 2)}
            </pre>
          </Collapsible>
        </div>
      )}
      {(result || error) && (
        <div className="border-t border-[var(--border)] px-3 py-1.5">
          <Collapsible
            header={
              <span className={`text-[10px] font-medium uppercase tracking-wider ${error ? 'text-red-400' : 'text-[var(--muted-foreground)]'}`}>
                {error ? 'Error' : 'Result'}
              </span>
            }
          >
            <pre className={`mt-1 max-h-32 overflow-auto font-mono text-[11px] leading-relaxed ${error ? 'text-red-400/80' : 'text-[var(--muted-foreground)]'}`}>
              {error || result}
            </pre>
          </Collapsible>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Thinking Block
// ────────────────────────────────────────────────────────────
function PlaybackThinking({ text, durationMs }: { text: string; durationMs?: number }) {
  return (
    <div className="mb-2 animate-[playback-fade_0.5s_ease-out]">
      <Collapsible
        header={
          <span className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-500/15 text-purple-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 01-6.364-2.637A5 5 0 018.464 6.1a5.002 5.002 0 017.072 0 5 5 0 01-1.172 7.265" />
              </svg>
            </span>
            Thinking
            {durationMs !== undefined && (
              <span className="text-[10px] opacity-60">
                ({durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`})
              </span>
            )}
          </span>
        }
      >
        <div className="ml-6 rounded border border-purple-500/10 bg-purple-500/5 px-3 py-2">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-purple-300/70">
            {text}
          </pre>
        </div>
      </Collapsible>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Single Message Renderer
// ────────────────────────────────────────────────────────────
function PlaybackMessage({ msg, isLatest }: { msg: Message; isLatest: boolean }) {
  const timestamp = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  if (msg.role === 'user') {
    const text = msg.contentJson.find((b) => b.type === 'text')?.text || ''
    return (
      <div className={`py-3 ${isLatest ? 'animate-[playback-fade_0.4s_ease-out]' : ''}`}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 font-mono text-lg font-bold text-blue-400">
            &#10095;
          </span>
          <div className="min-w-0 flex-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--foreground)]">
              {text}
            </pre>
          </div>
          <span className="shrink-0 pt-1 text-[10px] text-[var(--muted-foreground)]">
            {timestamp}
          </span>
        </div>
      </div>
    )
  }

  // Assistant message
  const blocks = msg.contentJson
  const renderedBlocks: React.ReactNode[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (block.type === 'thinking' && block.thinking) {
      const thinkingData = msg.thinkingJson?.[0]
      renderedBlocks.push(
        <PlaybackThinking
          key={`thinking-${i}`}
          text={block.thinking}
          durationMs={thinkingData?.durationMs}
        />
      )
    } else if (block.type === 'text' && block.text) {
      renderedBlocks.push(
        <div key={`text-${i}`} className="mb-2 rounded-lg bg-[var(--secondary)]/60 border border-[var(--border)] px-3 py-2">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--foreground)]">
            {block.text}
          </pre>
        </div>
      )
    } else if (block.type === 'tool_use') {
      const nextBlock = blocks[i + 1]
      const toolResult = nextBlock?.type === 'tool_result' ? nextBlock : undefined
      const richToolCall = msg.toolCallsJson?.find((tc) => tc.name === block.name)

      renderedBlocks.push(
        <PlaybackToolCall
          key={`tool-${i}`}
          block={toolResult ?? block}
          richTool={richToolCall}
        />
      )

      if (toolResult) i++
    }
  }

  return (
    <div className={`py-3 ${isLatest ? 'animate-[playback-fade_0.4s_ease-out]' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 pl-1">
          {renderedBlocks}
          {/* Token usage footer */}
          {msg.costUsd !== undefined && msg.costUsd > 0 && (
            <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
              {msg.inputTokens !== undefined && (
                <span>{formatTokens(msg.inputTokens)} input</span>
              )}
              {msg.outputTokens !== undefined && (
                <span>{formatTokens(msg.outputTokens)} output</span>
              )}
              <span>{formatCost(msg.costUsd)}</span>
              {msg.durationMs !== undefined && msg.durationMs > 0 && (
                <span>{(msg.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          )}
        </div>
        <span className="shrink-0 pt-1 text-[10px] text-[var(--muted-foreground)]">
          {timestamp}
        </span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Session Playback Component
// ────────────────────────────────────────────────────────────
export function SessionPlayback({ messages, onClose }: SessionPlaybackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const total = messages.length

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying || currentIndex >= total - 1) {
      if (currentIndex >= total - 1) setIsPlaying(false)
      return
    }
    const delay = 2000 / speed
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1
        if (next >= total - 1) {
          setIsPlaying(false)
        }
        return Math.min(next, total - 1)
      })
    }, delay)
    return () => clearInterval(timer)
  }, [isPlaying, currentIndex, speed, total])

  // Auto-scroll to bottom when new message appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentIndex])

  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => Math.min(total - 1, prev + 1))
  }, [total])

  const togglePlay = useCallback(() => {
    if (currentIndex >= total - 1) {
      // Restart from beginning
      setCurrentIndex(0)
      setIsPlaying(true)
    } else {
      setIsPlaying((prev) => !prev)
    }
  }, [currentIndex, total])

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      if (prev === 1) return 2
      if (prev === 2) return 4
      return 1
    })
  }, [])

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const fraction = (e.clientX - rect.left) / rect.width
      const index = Math.round(fraction * (total - 1))
      setCurrentIndex(Math.max(0, Math.min(total - 1, index)))
    },
    [total]
  )

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        stepBackward()
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        stepForward()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, togglePlay, stepBackward, stepForward])

  const visibleMessages = messages.slice(0, currentIndex + 1)
  const progress = total > 1 ? (currentIndex / (total - 1)) * 100 : 100

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--card)]/98 backdrop-blur-sm">
      {/* Playback header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)]/15">
            <svg className="h-4 w-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Session Replay</h2>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              Message {currentIndex + 1} of {total}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          title="Close (Esc)"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:px-8 lg:px-16"
      >
        <div className="mx-auto max-w-3xl divide-y divide-[var(--border)]/30">
          {visibleMessages.map((msg, i) => (
            <PlaybackMessage
              key={msg.id}
              msg={msg}
              isLatest={i === visibleMessages.length - 1}
            />
          ))}
        </div>
        {/* Bottom spacer so last message isn't hidden behind controls */}
        <div className="h-24" />
      </div>

      {/* Playback controls bar */}
      <div className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-3">
        {/* Progress bar */}
        <div
          className="group mb-3 h-1.5 cursor-pointer rounded-full bg-[var(--secondary)]"
          onClick={handleProgressClick}
          title={`Jump to message (${currentIndex + 1}/${total})`}
        >
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Left: time info */}
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
            {messages[currentIndex] && (
              <span>
                {new Date(messages[currentIndex].createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            <span className="opacity-40">|</span>
            <span>{currentIndex + 1} / {total}</span>
          </div>

          {/* Center: transport controls */}
          <div className="flex items-center gap-1">
            {/* Step backward */}
            <button
              type="button"
              onClick={stepBackward}
              disabled={currentIndex === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:opacity-30"
              title="Previous message"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
            </button>

            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-colors hover:opacity-90"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
                </svg>
              )}
            </button>

            {/* Step forward */}
            <button
              type="button"
              onClick={stepForward}
              disabled={currentIndex >= total - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:opacity-30"
              title="Next message"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
            </button>
          </div>

          {/* Right: speed control */}
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]"
            title="Playback speed"
          >
            {speed}x
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="mt-2 hidden items-center justify-center gap-3 text-[10px] text-[var(--muted-foreground)] sm:flex">
          <span><kbd className="rounded bg-[var(--secondary)] px-1 py-0.5 font-mono">Space</kbd> Play/Pause</span>
          <span><kbd className="rounded bg-[var(--secondary)] px-1 py-0.5 font-mono">&larr;</kbd> <kbd className="rounded bg-[var(--secondary)] px-1 py-0.5 font-mono">&rarr;</kbd> Step</span>
          <span><kbd className="rounded bg-[var(--secondary)] px-1 py-0.5 font-mono">Esc</kbd> Close</span>
        </div>
      </div>

      {/* CSS keyframes for animations */}
      <style>{`
        @keyframes playback-fade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes playback-expand {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 500px; }
        }
      `}</style>
    </div>
  )
}
