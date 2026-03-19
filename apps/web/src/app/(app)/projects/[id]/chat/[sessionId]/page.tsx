'use client'

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useChatStore } from '@/stores/chat.store'
import type { StreamingToolCall } from '@/stores/chat.store'
import { api } from '@/lib/api-client'
import { wsClient } from '@/lib/ws-client'
import { formatTokens, uuid } from '@/lib/utils'
import type { Session, Message, ContentBlock, ToolCall, ThinkingBlock, FileNode } from '@axy/shared'
import { MODELS } from '@axy/shared'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { SlashCommandMenu, type SlashCommandDef } from '@/components/chat/slash-command-menu'
import { ArtifactPreview } from '@/components/chat/artifact-preview'
import { TaskPanel } from '@/components/tasks/task-panel'
import { PermissionDialog } from '@/components/chat/permission-dialog'
import { usePermissionStore } from '@/stores/permission.store'
import {
  AgentOrchestrationPanel,
  useOrchestrator,
  type BuiltInAgent,
} from '@/components/chat/agent-orchestration-panel'
import { SessionPlayback } from '@/components/chat/session-playback'
import { DiffViewer, extractDiffData } from '@/components/chat/diff-viewer'
import { useAgentStore } from '@/stores/agent.store'
import { useSkillStore } from '@/stores/skill.store'
import { ChatInput, type ChatInputSendPayload } from '@/components/chat/chat-input'
import { SplitTerminal } from '@/components/terminal/split-terminal'

// ────────────────────────────────────────────────────────────
// Collapsible Section
// ────────────────────────────────────────────────────────────
function Collapsible({
  defaultOpen = false,
  header,
  children,
}: {
  defaultOpen?: boolean
  header: (isOpen: boolean) => React.ReactNode
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {header(isOpen)}
      </button>
      {isOpen && <div className="mt-1.5">{children}</div>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Thinking Block (for completed messages)
// ────────────────────────────────────────────────────────────
function ThinkingBlockView({
  thinking,
  durationMs,
}: {
  thinking: string
  durationMs?: number
}) {
  return (
    <div className="mb-2">
      <Collapsible
        defaultOpen={false}
        header={() => (
          <span className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-purple-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 01-6.364-2.637A5 5 0 018.464 6.1a5.002 5.002 0 017.072 0 5 5 0 01-1.172 7.265" />
              </svg>
            </span>
            <span>
              Thinking
              {durationMs !== undefined && (
                <span className="ml-1 text-[10px] opacity-50">
                  ({durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`})
                </span>
              )}
            </span>
          </span>
        )}
      >
        <div className="ml-6 rounded border border-purple-500/10 bg-purple-500/5 px-3 py-2">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-purple-300/70">
            {thinking}
          </pre>
        </div>
      </Collapsible>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Streaming Thinking (live, pulsing)
// ────────────────────────────────────────────────────────────
function StreamingThinkingView({
  thinking,
  startedAt,
}: {
  thinking: string
  startedAt: number | null
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 100)
    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <div className="mb-3">
      <Collapsible
        defaultOpen={true}
        header={(isOpen) => (
          <span className="flex items-center gap-2 text-xs font-medium text-purple-400">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-500/20 text-purple-400">
              <svg className="h-3 w-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 01-6.364-2.637A5 5 0 018.464 6.1a5.002 5.002 0 017.072 0 5 5 0 01-1.172 7.265" />
              </svg>
            </span>
            {!isOpen ? (
              <span className="animate-pulse">
                Thinking...
                {elapsed > 0 && (
                  <span className="ml-1 text-[10px] opacity-60">
                    ({elapsed >= 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`})
                  </span>
                )}
              </span>
            ) : (
              <span className="animate-pulse">Thinking...</span>
            )}
          </span>
        )}
      >
        <div className="ml-6 rounded border border-purple-500/10 bg-purple-500/5 px-3 py-2">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-purple-300/70">
            {thinking}
            <span className="animate-pulse">|</span>
          </pre>
        </div>
      </Collapsible>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Tool name color mapping (CLI-like)
// ────────────────────────────────────────────────────────────
const TOOL_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Read: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', icon: 'text-cyan-400' },
  Write: { bg: 'bg-orange-500/15', text: 'text-orange-400', icon: 'text-orange-400' },
  Edit: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', icon: 'text-yellow-400' },
  Bash: { bg: 'bg-green-500/15', text: 'text-green-400', icon: 'text-green-400' },
  Glob: { bg: 'bg-blue-500/15', text: 'text-blue-400', icon: 'text-blue-400' },
  Grep: { bg: 'bg-violet-500/15', text: 'text-violet-400', icon: 'text-violet-400' },
  Agent: { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: 'text-purple-400' },
  WebSearch: { bg: 'bg-sky-500/15', text: 'text-sky-400', icon: 'text-sky-400' },
  WebFetch: { bg: 'bg-sky-500/15', text: 'text-sky-400', icon: 'text-sky-400' },
  TodoWrite: { bg: 'bg-pink-500/15', text: 'text-pink-400', icon: 'text-pink-400' },
  NotebookEdit: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', icon: 'text-indigo-400' },
}

function getToolColor(name?: string) {
  if (!name) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: 'text-emerald-400' }
  return TOOL_COLORS[name] || { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: 'text-emerald-400' }
}

// ────────────────────────────────────────────────────────────
// Tool Call Block (for completed messages) - CLI-like style
// ────────────────────────────────────────────────────────────
function ToolCallBlockView({
  toolCall,
  toolResult,
}: {
  toolCall: ContentBlock | ToolCall
  toolResult?: ContentBlock
}) {
  const name = 'name' in toolCall ? toolCall.name : undefined
  const input = toolCall.input
  const result = toolResult?.content ?? ('result' in toolCall ? (toolCall as ToolCall).result : undefined)
  const error = 'error' in toolCall ? (toolCall as ToolCall).error : undefined
  const durationMs = 'durationMs' in toolCall ? (toolCall as ToolCall).durationMs : undefined
  const color = getToolColor(name)

  // Check if this is a file-edit tool and extract diff data
  const diffData = useMemo(() => {
    if (!name || !input) return null
    return extractDiffData(name, input)
  }, [name, input])

  return (
    <div className="mb-2 rounded-lg border border-[var(--border)]/60 bg-[var(--card)] overflow-hidden">
      {/* Tool header - CLI style */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${color.icon}`}>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${color.bg} ${color.text}`}>
          {name || 'tool'}
        </span>
        {durationMs !== undefined && (
          <span className="ml-auto text-[10px] text-[var(--muted-foreground)]/60">
            {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
          </span>
        )}
      </div>

      {/* Inline diff viewer for file-edit tools */}
      {diffData && (
        <div className="border-t border-[var(--border)]/40">
          <DiffViewer
            filename={diffData.filename}
            oldContent={diffData.oldContent}
            newContent={diffData.newContent}
          />
        </div>
      )}

      {/* Tool input - collapsible like CLI */}
      {input && Object.keys(input).length > 0 && (
        <div className="border-t border-[var(--border)]/40 px-3 py-1.5">
          <Collapsible
            defaultOpen={false}
            header={() => (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]/60">
                INPUT
              </span>
            )}
          >
            <pre className="mt-1.5 max-h-48 overflow-auto rounded bg-[var(--secondary)]/50 p-2 font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              {JSON.stringify(input, null, 2)}
            </pre>
          </Collapsible>
        </div>
      )}

      {/* Tool result - collapsible */}
      {(result || error) && (
        <div className="border-t border-[var(--border)]/40 px-3 py-1.5">
          <Collapsible
            defaultOpen={false}
            header={() => (
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${error ? 'text-red-400' : 'text-[var(--muted-foreground)]/60'}`}>
                {error ? 'ERROR' : 'OUTPUT'}
              </span>
            )}
          >
            <pre className={`mt-1.5 max-h-64 overflow-auto rounded bg-[var(--secondary)]/50 p-2 font-mono text-[11px] leading-relaxed ${error ? 'text-red-400/80' : 'text-[var(--muted-foreground)]'}`}>
              {error || result}
            </pre>
          </Collapsible>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Streaming Tool Call (live)
// ────────────────────────────────────────────────────────────
function StreamingToolCallView({ tc }: { tc: StreamingToolCall }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!tc.isRunning) return
    const interval = setInterval(() => {
      setElapsed(Date.now() - tc.startedAt)
    }, 100)
    return () => clearInterval(interval)
  }, [tc.isRunning, tc.startedAt])

  const duration = tc.durationMs ?? elapsed
  const color = getToolColor(tc.name)

  // Check if this is a file-edit tool and extract diff data
  const diffData = useMemo(() => {
    if (!tc.name || !tc.input || Object.keys(tc.input).length === 0) return null
    return extractDiffData(tc.name, tc.input)
  }, [tc.name, tc.input])

  return (
    <div className="mb-2 rounded-lg border border-[var(--border)]/60 bg-[var(--card)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tc.isRunning ? 'text-amber-400' : color.icon}`}>
          {tc.isRunning ? (
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${tc.isRunning ? 'bg-amber-500/15 text-amber-400' : `${color.bg} ${color.text}`}`}>
          {tc.name}
        </span>
        {tc.isRunning && (
          <span className="animate-pulse text-[10px] text-amber-400/60">running...</span>
        )}
        <span className="ml-auto text-[10px] text-[var(--muted-foreground)]/60">
          {duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`}
        </span>
      </div>

      {/* Inline diff viewer for file-edit tools */}
      {diffData && (
        <div className="border-t border-[var(--border)]/40">
          <DiffViewer
            filename={diffData.filename}
            oldContent={diffData.oldContent}
            newContent={diffData.newContent}
          />
        </div>
      )}

      {/* Input */}
      {tc.input && Object.keys(tc.input).length > 0 && (
        <div className="border-t border-[var(--border)]/40 px-3 py-1.5">
          <Collapsible
            defaultOpen={false}
            header={() => (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]/60">
                INPUT
              </span>
            )}
          >
            <pre className="mt-1.5 max-h-48 overflow-auto rounded bg-[var(--secondary)]/50 p-2 font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </Collapsible>
        </div>
      )}

      {/* Result */}
      {tc.result && (
        <div className="border-t border-[var(--border)]/40 px-3 py-1.5">
          <Collapsible
            defaultOpen={false}
            header={() => (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]/60">
                OUTPUT
              </span>
            )}
          >
            <pre className="mt-1.5 max-h-64 overflow-auto rounded bg-[var(--secondary)]/50 p-2 font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              {tc.result}
            </pre>
          </Collapsible>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Copy button for code blocks
// ────────────────────────────────────────────────────────────
function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [code])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-[var(--border)]/50 bg-[#282c34]/90 px-2 py-1 text-[10px] text-[var(--muted-foreground)] opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:text-[var(--foreground)]"
      title="Copy code"
    >
      {copied ? (
        <>
          <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

// ────────────────────────────────────────────────────────────
// Markdown renderer with syntax highlighting
// ────────────────────────────────────────────────────────────
const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const code = String(children).replace(/\n$/, '')
    const isBlock = match || code.includes('\n')

    // Inline code
    if (!isBlock) {
      return (
        <code
          className="rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[0.85em] text-[var(--primary)] before:content-[''] after:content-['']"
          {...props}
        >
          {children}
        </code>
      )
    }

    // Artifact preview for rich content types (HTML, Markdown, Mermaid, SVG)
    const lang = match?.[1]?.toLowerCase()
    const artifactLangs = ['html', 'markdown', 'md', 'mermaid', 'svg']
    const lineCount = code.split('\n').length
    if (lang && artifactLangs.includes(lang) && lineCount > 5) {
      return <ArtifactPreview content={code} language={lang} />
    }

    // Fenced code block with syntax highlighting
    return (
      <>
        <CopyCodeButton code={code} />
        <SyntaxHighlighter
          style={oneDark}
          language={match?.[1] || 'text'}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '0.8rem',
            lineHeight: '1.5',
            background: 'transparent',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </>
    )
  },
  pre({ children }) {
    return (
      <div className="group relative my-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[#282c34]">
        {children}
      </div>
    )
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    )
  },
  thead({ children }) {
    return <thead className="bg-[var(--secondary)]">{children}</thead>
  },
  th({ children }) {
    return (
      <th className="border-b border-[var(--border)] px-3 py-2 text-left text-xs font-semibold text-[var(--foreground)]">
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td className="border-b border-[var(--border)]/50 px-3 py-2 text-[var(--muted-foreground)]">
        {children}
      </td>
    )
  },
  tr({ children }) {
    return <tr className="transition-colors hover:bg-[var(--accent)]/30">{children}</tr>
  },
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-[var(--foreground)] prose-headings:font-semibold prose-p:text-[var(--foreground)] prose-p:leading-relaxed prose-strong:text-[var(--foreground)] prose-a:text-[var(--primary)] prose-a:underline prose-li:text-[var(--foreground)] prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-table:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// User Message
// ────────────────────────────────────────────────────────────
const UserMessageView = memo(function UserMessageView({ msg }: { msg: Message }) {
  const text = msg.contentJson.find((b) => b.type === 'text')?.text || ''
  const images = msg.contentJson.filter((b) => b.type === 'image')
  return (
    <div className="group flex items-start gap-3 py-3">
      <span className="mt-0.5 shrink-0 font-mono text-lg font-bold text-[var(--primary)]">
        &#10095;
      </span>
      <div className="min-w-0 flex-1">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--foreground)]">
          {text}
        </pre>
        {images.length > 0 && (
          <div className="mt-1 flex gap-1">
            {images.map((img, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded bg-[var(--secondary)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {img.mimeType || 'image'}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100">
        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
})

// ────────────────────────────────────────────────────────────
// Unified Tool Calls Summary (collapsed by default)
// ────────────────────────────────────────────────────────────
function ToolCallsSummary({
  toolCalls,
  toolResults,
}: {
  toolCalls: { call: ContentBlock | ToolCall; result?: ContentBlock }[]
  toolResults?: Map<string, ContentBlock>
}) {
  const [expanded, setExpanded] = useState(false)

  // Group by tool name for summary
  const summary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { call } of toolCalls) {
      const name = 'name' in call ? (call.name || 'tool') : 'tool'
      counts[name] = (counts[name] || 0) + 1
    }
    return Object.entries(counts)
  }, [toolCalls])

  if (toolCalls.length === 0) return null

  return (
    <div className="mb-2">
      {/* Compact summary bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)]/50 bg-[var(--card)] px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-emerald-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {summary.map(([name, count]) => {
            const color = getToolColor(name)
            return (
              <span key={name} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${color.bg} ${color.text}`}>
                {name}
                {count > 1 && <span className="text-[10px] opacity-70">x{count}</span>}
              </span>
            )
          })}
        </div>
        <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]/60">
          {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''}
        </span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail view */}
      {expanded && (
        <div className="mt-1 space-y-1.5 pl-7">
          {toolCalls.map(({ call, result }, i) => (
            <ToolCallBlockView key={i} toolCall={call} toolResult={result} />
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Assistant Message (completed)
// ────────────────────────────────────────────────────────────
const AssistantMessageView = memo(function AssistantMessageView({ msg }: { msg: Message }) {
  const blocks = msg.contentJson || []

  // Separate content into thinking, text, and tool calls
  const { thinkingBlocks, textBlocks, toolCallPairs } = useMemo(() => {
    const thinking: { thinking: string; durationMs?: number }[] = []
    const text: string[] = []
    const tools: { call: ContentBlock | ToolCall; result?: ContentBlock }[] = []

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      if (block.type === 'thinking' && block.thinking) {
        const thinkingData = msg.thinkingJson?.[0]
        thinking.push({ thinking: block.thinking, durationMs: thinkingData?.durationMs })
      } else if (block.type === 'text' && block.text) {
        text.push(block.text)
      } else if (block.type === 'tool_use') {
        const nextBlock = blocks[i + 1]
        const toolResult = nextBlock?.type === 'tool_result' ? nextBlock : undefined
        // Try to find richer tool call info from toolCallsJson
        const richToolCall = msg.toolCallsJson?.find((tc) => tc.name === block.name && tc.id === block.id)
          || msg.toolCallsJson?.find((tc) => tc.name === block.name)
        tools.push({ call: richToolCall || block, result: toolResult })
        if (toolResult) i++
      }
    }

    // Also add tool calls from toolCallsJson that weren't in contentJson blocks
    if (tools.length === 0 && msg.toolCallsJson && msg.toolCallsJson.length > 0) {
      for (const tc of msg.toolCallsJson) {
        tools.push({ call: tc })
      }
    }

    return { thinkingBlocks: thinking, textBlocks: text, toolCallPairs: tools }
  }, [blocks, msg.toolCallsJson, msg.thinkingJson])

  return (
    <div className="py-3 pl-1">
      {/* Thinking */}
      {thinkingBlocks.map((tb, i) => (
        <ThinkingBlockView key={`t-${i}`} thinking={tb.thinking} durationMs={tb.durationMs} />
      ))}

      {/* Tool calls - unified summary bar */}
      {toolCallPairs.length > 0 && (
        <ToolCallsSummary toolCalls={toolCallPairs} />
      )}

      {/* Text content */}
      {textBlocks.length > 0 ? (
        textBlocks.map((text, i) => (
          <div key={`txt-${i}`} className="mb-3">
            <MarkdownContent content={text} />
          </div>
        ))
      ) : toolCallPairs.length > 0 && thinkingBlocks.length === 0 ? (
        <p className="text-xs italic text-[var(--muted-foreground)]">
          Executed {toolCallPairs.length} tool{toolCallPairs.length > 1 ? 's' : ''} (expand above to see details)
        </p>
      ) : null}

      {/* Token usage footer */}
      {(msg.inputTokens !== undefined || msg.outputTokens !== undefined) && (
        <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
          {msg.inputTokens !== undefined && (
            <span>{formatTokens(msg.inputTokens)} input</span>
          )}
          {msg.outputTokens !== undefined && (
            <span>{formatTokens(msg.outputTokens)} output</span>
          )}
          {msg.durationMs !== undefined && msg.durationMs > 0 && (
            <span>{(msg.durationMs / 1000).toFixed(1)}s</span>
          )}
        </div>
      )}
    </div>
  )
})

// ────────────────────────────────────────────────────────────
// Streaming Assistant View (live output)
// ────────────────────────────────────────────────────────────
function StreamingAssistantView() {
  const { streamingThinking, streamingContent, streamingToolCalls, thinkingStartedAt } =
    useChatStore()
  const [showAllTools, setShowAllTools] = useState(false)

  const hasContent =
    streamingThinking || streamingContent || streamingToolCalls.length > 0

  // Find currently running tool and completed tools
  const runningTool = streamingToolCalls.find((tc) => tc.isRunning)
  const completedTools = streamingToolCalls.filter((tc) => !tc.isRunning)
  const completedCount = completedTools.length

  // Group completed tools by name for summary
  const completedSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tc of completedTools) {
      counts[tc.name] = (counts[tc.name] || 0) + 1
    }
    return Object.entries(counts)
  }, [completedTools])

  // Build a compact status description for the running tool
  const statusLine = useMemo(() => {
    if (!runningTool) return null
    const name = runningTool.name
    const inp = runningTool.input
    if (name === 'Read' && inp.file_path) return `Reading ${String(inp.file_path).split('/').pop()}...`
    if (name === 'Write' && inp.file_path) return `Writing ${String(inp.file_path).split('/').pop()}...`
    if (name === 'Edit' && inp.file_path) return `Editing ${String(inp.file_path).split('/').pop()}...`
    if (name === 'Bash' && inp.command) return `Running ${String(inp.command).slice(0, 60)}${String(inp.command).length > 60 ? '...' : ''}`
    if (name === 'Glob' && inp.pattern) return `Searching for ${String(inp.pattern)}...`
    if (name === 'Grep' && inp.pattern) return `Searching for "${String(inp.pattern).slice(0, 40)}"...`
    if (name === 'WebSearch' && inp.query) return `Searching web: ${String(inp.query).slice(0, 40)}...`
    if (name === 'WebFetch' && inp.url) return `Fetching ${String(inp.url).slice(0, 50)}...`
    return `Running ${name}...`
  }, [runningTool])

  if (!hasContent) {
    return (
      <div className="py-3 pl-1">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">Processing...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="py-3 pl-1">
      {/* Thinking */}
      {streamingThinking && (
        <StreamingThinkingView
          thinking={streamingThinking}
          startedAt={thinkingStartedAt}
        />
      )}

      {/* Compact status line: shows what tool is currently doing */}
      {statusLine && (
        <div className="mb-2 flex items-center gap-2 rounded border border-[var(--border)]/30 bg-[var(--secondary)]/30 px-3 py-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          <span className="truncate font-mono text-[11px] text-[var(--muted-foreground)]">
            {statusLine}
          </span>
        </div>
      )}

      {/* Completed tools - compact summary bar (clickable to expand) */}
      {completedCount > 0 && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setShowAllTools(!showAllTools)}
            className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)]/50 bg-[var(--card)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--accent)]/50"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-emerald-400">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {completedSummary.map(([name, count]) => {
                const color = getToolColor(name)
                return (
                  <span key={name} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${color.bg} ${color.text}`}>
                    {name}
                    {count > 1 && <span className="opacity-70">x{count}</span>}
                  </span>
                )
              })}
            </div>
            <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]/50">
              {completedCount} done
            </span>
            <svg className={`h-3 w-3 shrink-0 text-[var(--muted-foreground)]/50 transition-transform ${showAllTools ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showAllTools && (
            <div className="mt-1 space-y-1 pl-6">
              {completedTools.map((tc) => (
                <StreamingToolCallView key={tc.id} tc={tc} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Currently running tool - always visible */}
      {runningTool && (
        <StreamingToolCallView tc={runningTool} />
      )}

      {/* Text content - rendered as markdown in real-time */}
      {streamingContent && (
        <div className="mb-3">
          <MarkdownContent content={streamingContent} />
          <span className="inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-[var(--primary)]" />
        </div>
      )}

      {/* Waiting indicator when all tools done but no text yet */}
      {!streamingContent && !streamingThinking && streamingToolCalls.length === 0 && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">Processing...</span>
        </div>
      )}
      {!streamingContent && !runningTool && completedCount > 0 && (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">Generating response...</span>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Model Selector Dropdown
// ────────────────────────────────────────────────────────────
const TIER_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  premium: { dot: 'bg-amber-400', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  standard: { dot: 'bg-blue-400', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  fast: { dot: 'bg-green-400', bg: 'bg-green-500/10', text: 'text-green-400' },
}

function ModelSelector({
  currentModel,
  onSelect,
}: {
  currentModel: string
  onSelect: (modelId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = MODELS.find((m) => m.id === currentModel)
  const selectedTier = selected
    ? TIER_COLORS[selected.tier] || TIER_COLORS.standard
    : TIER_COLORS.standard

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]/80"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${selectedTier.dot}`} />
        <span className="font-mono">{selected?.name || currentModel}</span>
        <svg
          className={`h-3 w-3 text-[var(--muted-foreground)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg">
          {MODELS.map((model) => {
            const tier = TIER_COLORS[model.tier] || TIER_COLORS.standard
            const isActive = model.id === currentModel
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  if (model.id !== currentModel) {
                    onSelect(model.id)
                  }
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-[var(--secondary)] ${
                  isActive ? 'bg-[var(--secondary)]/60' : ''
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tier.dot}`} />
                <span className="flex-1 font-medium text-[var(--foreground)]">
                  {model.name}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${tier.bg} ${tier.text}`}
                >
                  {model.tier}
                </span>
                {isActive && (
                  <svg
                    className="h-3 w-3 shrink-0 text-[var(--primary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Effort Level Selector
// ────────────────────────────────────────────────────────────
const EFFORT_LEVELS = [
  { id: 'low', label: 'Low', color: 'text-green-400', bg: 'bg-green-500/10', desc: 'Fast, minimal thinking' },
  { id: 'medium', label: 'Medium', color: 'text-blue-400', bg: 'bg-blue-500/10', desc: 'Balanced performance' },
  { id: 'high', label: 'High', color: 'text-amber-400', bg: 'bg-amber-500/10', desc: 'Extended thinking' },
  { id: 'max', label: 'Max', color: 'text-red-400', bg: 'bg-red-500/10', desc: 'Maximum reasoning depth' },
] as const

function EffortSelector({
  current,
  onSelect,
}: {
  current: string
  onSelect: (level: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = EFFORT_LEVELS.find((l) => l.id === current) || EFFORT_LEVELS[1]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]/80"
        title="Effort level (thinking depth)"
      >
        <svg className={`h-3 w-3 ${selected.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>{selected.label}</span>
        <svg
          className={`h-3 w-3 text-[var(--muted-foreground)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg">
          {EFFORT_LEVELS.map((level) => {
            const isActive = level.id === current
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => {
                  onSelect(level.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-[var(--secondary)] ${
                  isActive ? 'bg-[var(--secondary)]/60' : ''
                }`}
              >
                <span className={`font-medium ${level.color}`}>{level.label}</span>
                <span className="flex-1 text-[var(--muted-foreground)]">{level.desc}</span>
                {isActive && (
                  <svg
                    className="h-3 w-3 shrink-0 text-[var(--primary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main Chat Page
// ────────────────────────────────────────────────────────────
export default function ChatSessionPage() {
  const params = useParams()
  const projectId = params.id as string
  const sessionId = params.sessionId as string
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const prefillApplied = useRef(false)
  const [autoOrchestrate, setAutoOrchestrate] = useState(false)
  const [showPlayback, setShowPlayback] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showCustomAgentPicker, setShowCustomAgentPicker] = useState(false)
  // Plan mode toggle (per-session, not persistent)
  const [planMode, setPlanMode] = useState(false)
  // Effort level (thinking depth)
  const [effortLevel, setEffortLevel] = useState('medium')
  const [projectFiles, setProjectFiles] = useState<FileNode[]>([])
  // Scroll to bottom button
  const [showScrollButton, setShowScrollButton] = useState(false)
  // Message search
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHighlightIndex, setSearchHighlightIndex] = useState(-1)
  // Loading more messages (pagination)
  const [loadingMore, setLoadingMore] = useState(false)

  // Custom agents & skills
  const { agents: customAgents, fetchAgents } = useAgentStore()
  const { skills: customSkills, fetchSkills, catalogSkills, fetchCatalog } = useSkillStore()

  // Fetch custom agents and skills on mount
  useEffect(() => {
    fetchAgents()
    fetchSkills()
    fetchCatalog()
  }, [fetchAgents, fetchSkills, fetchCatalog])

  // Autosave draft: restore on mount
  // Convert skills into slash commands for the menu (DB skills + catalog skills)
  const skillCommands = useMemo<SlashCommandDef[]>(() => {
    const dbTriggers = new Set<string>()
    const cmds: SlashCommandDef[] = customSkills.map((skill) => {
      const trigger = skill.trigger?.replace(/^\//, '') || skill.name.toLowerCase().replace(/\s+/g, '-')
      dbTriggers.add(trigger)
      return {
        name: trigger,
        description: skill.description || skill.name,
        category: 'custom' as const,
        icon: undefined,
        argHint: (skill.promptTemplate?.includes('{{') || skill.promptTemplate?.includes('$ARGUMENTS')) ? '<args>' : undefined,
      }
    })
    // Add catalog skills not already imported
    for (const cs of catalogSkills) {
      const trigger = cs.trigger?.replace(/^\//, '')
      if (trigger && !dbTriggers.has(trigger)) {
        cmds.push({
          name: trigger,
          description: cs.description || cs.name,
          category: 'custom' as const,
          icon: undefined,
          argHint: (cs.promptTemplate?.includes('{{') || cs.promptTemplate?.includes('$ARGUMENTS')) ? '<args>' : undefined,
        })
      }
    }
    return cmds
  }, [customSkills, catalogSkills])

  // Pre-fill input from ?prefill= query param (e.g. from notes "Send to Chat")
  useEffect(() => {
    if (prefillApplied.current) return
    const prefill = searchParams.get('prefill')
    if (prefill) {
      // @ts-expect-error - ChatInput exposes via window
      window.__chatInput?.setInput(decodeURIComponent(prefill))
      prefillApplied.current = true
      window.history.replaceState({}, '', window.location.pathname)
      // @ts-expect-error - ChatInput exposes via window
      window.__chatInput?.focus()
    }
  }, [searchParams])

  const {
    activeAgent,
    reasoning: agentReasoning,
    dismissAgent,
    overrideAgent,
    setAgent,
  } = useOrchestrator()

  const {
    currentSession,
    messages,
    isStreaming,
    streamingToolCalls,
    hasMore,
    setSession,
    updateSessionModel,
    branchSession,
    fetchMessages,
    fetchMoreMessages,
    sendMessage,
    stopGeneration,
    checkAndReplayStream,
    budgetWarning,
    dismissBudgetWarning,
  } = useChatStore()

  const [parentSessionTitle, setParentSessionTitle] = useState<string | null>(null)

  const handleExport = useCallback(async (format: 'markdown' | 'json') => {
    setShowExportMenu(false)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3456`
      const token = localStorage.getItem('axy_token') || ''
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')

      let blob: Blob
      let filename: string
      if (format === 'markdown') {
        const text = await res.text()
        blob = new Blob([text], { type: 'text/markdown' })
        filename = `${(currentSession?.title || 'session').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`
      } else {
        const text = await res.text()
        blob = new Blob([text], { type: 'application/json' })
        filename = `${(currentSession?.title || 'session').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    }
  }, [sessionId, currentSession?.title])

  // Load session, messages, and check for active CLI stream
  useEffect(() => {
    let cancelled = false
    async function load() {
      // 1. Subscribe to WS FIRST so we don't miss live events
      wsClient.subscribeToSession(sessionId)
      // 2. Load session info + saved messages from DB
      const session = await api.get<Session>(`/api/sessions/${sessionId}`)
      if (cancelled) return
      setSession(session)
      if (session.effort) setEffortLevel(session.effort)
      await fetchMessages(sessionId)
      // Populate message history from loaded user messages
      const loadedMessages = useChatStore.getState().messages
      const userTexts = loadedMessages
        .filter((m) => m.role === 'user')
        .map((m) => {
          const blocks = (m.contentJson as { type: string; text?: string }[]) || []
          return blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('')
        })
        .filter(Boolean)
        .reverse()
      // Message history is managed by ChatInput component
      // 3. Small delay to let WS subscription register server-side before replay
      await new Promise(r => setTimeout(r, 300))
      // 4. Check if CLI is still running and replay buffered events
      if (!cancelled) await checkAndReplayStream(sessionId)
    }
    load()

    const cleanupPermissions = usePermissionStore.getState().initWsListeners()
    return () => {
      cancelled = true
      cleanupPermissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Load parent session title for branch indicator
  useEffect(() => {
    if (!currentSession?.parentSessionId) {
      setParentSessionTitle(null)
      return
    }
    api.get<Session>(`/api/sessions/${currentSession.parentSessionId}`)
      .then((parent) => setParentSessionTitle(parent.title || 'Chat Session'))
      .catch(() => setParentSessionTitle(null))
  }, [currentSession?.parentSessionId])

  // Fetch project files for @ mentions
  useEffect(() => {
    api.get<FileNode[]>(`/api/files/projects/${projectId}`)
      .then((files) => setProjectFiles(files))
      .catch(() => setProjectFiles([]))
  }, [projectId])

  // Message search: find matching message IDs
  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>()
    const q = searchQuery.toLowerCase()
    const ids = new Set<string>()
    for (const msg of messages) {
      const text = msg.contentJson?.map((b: ContentBlock) => b.text || b.thinking || '').join(' ') || ''
      if (text.toLowerCase().includes(q)) {
        ids.add(msg.id)
      }
    }
    return ids
  }, [messages, searchQuery])

  // Navigate search results
  const searchMatchArray = useMemo(() => {
    if (searchMatchIds.size === 0) return []
    return messages.filter((m) => searchMatchIds.has(m.id)).map((m) => m.id)
  }, [messages, searchMatchIds])

  // Scroll to search result
  useEffect(() => {
    if (searchHighlightIndex >= 0 && searchMatchArray[searchHighlightIndex]) {
      const el = document.getElementById(`msg-${searchMatchArray[searchHighlightIndex]}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [searchHighlightIndex, searchMatchArray])

  // Auto-scroll to bottom only if user is near the bottom
  const isNearBottomRef = useRef(true)

  const checkIfNearBottom = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      isNearBottomRef.current = distanceFromBottom < 150
      setShowScrollButton(distanceFromBottom > 200)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  const forceScrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
      isNearBottomRef.current = true
      setShowScrollButton(false)
    }
  }, [])

  // Track scroll position to detect if user scrolled up + load more on scroll to top
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => {
      checkIfNearBottom()
      // Load more messages when scrolled to top
      if (el.scrollTop < 50 && hasMore && !loadingMore) {
        setLoadingMore(true)
        const prevScrollHeight = el.scrollHeight
        fetchMoreMessages(sessionId).finally(() => {
          setLoadingMore(false)
          // Maintain scroll position after prepending messages
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              const newScrollHeight = scrollRef.current.scrollHeight
              scrollRef.current.scrollTop = newScrollHeight - prevScrollHeight
            }
          })
        })
      }
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [checkIfNearBottom, hasMore, loadingMore, fetchMoreMessages, sessionId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming, scrollToBottom])

  // Also scroll during streaming via an interval (only if near bottom)
  useEffect(() => {
    if (!isStreaming) return
    const interval = setInterval(scrollToBottom, 200)
    return () => clearInterval(interval)
  }, [isStreaming, scrollToBottom])

  // When streaming ends, snap to bottom
  const prevStreamingRef = useRef(false)
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      isNearBottomRef.current = true
      scrollToBottom()
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, scrollToBottom])

  // Focus input on mount
  useEffect(() => {
    // @ts-expect-error - ChatInput exposes via window
    window.__chatInput?.focus()
  }, [])

  const router = useRouter()

  // Execute a slash command locally instead of sending to Claude
  const executeSlashCommand = useCallback(
    (name: string, args: string) => {
      switch (name) {
        case 'model': {
          if (!args) break
          // Find model by partial match
          const match = MODELS.find(
            (m) =>
              m.id.toLowerCase().includes(args.toLowerCase()) ||
              m.name.toLowerCase().includes(args.toLowerCase())
          )
          if (match) {
            updateSessionModel(sessionId, match.id)
            // Show feedback as a system-style message
            const msg: Message = {
              id: uuid(),
              sessionId,
              role: 'assistant',
              contentJson: [{ type: 'text', text: `Model changed to **${match.name}** (${match.tier})` }],
              createdAt: new Date().toISOString(),
            }
            useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
          } else {
            const available = MODELS.map((m) => `\`${m.name}\``).join(', ')
            const msg: Message = {
              id: uuid(),
              sessionId,
              role: 'assistant',
              contentJson: [{ type: 'text', text: `Model "${args}" not found. Available: ${available}` }],
              createdAt: new Date().toISOString(),
            }
            useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
          }
          break
        }
        case 'clear': {
          useChatStore.setState({ messages: [] })
          break
        }
        case 'cost':
        case 'tokens': {
          const session = useChatStore.getState().currentSession
          if (session) {
            const msg: Message = {
              id: uuid(),
              sessionId,
              role: 'assistant',
              contentJson: [{
                type: 'text',
                text: `**Session Token Usage**\n- Input tokens: ${formatTokens(session.totalInputTokens || 0)}\n- Output tokens: ${formatTokens(session.totalOutputTokens || 0)}`,
              }],
              createdAt: new Date().toISOString(),
            }
            useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
          }
          break
        }
        case 'tasks':
          router.push(`/projects/${projectId}/tasks`)
          break
        case 'task': {
          if (args) {
            // Send as a regular message - Claude will handle it as a task request
            sendMessage(sessionId, `Create a task: ${args}`)
          } else {
            router.push(`/projects/${projectId}/tasks`)
          }
          break
        }
        case 'diff':
          router.push(`/projects/${projectId}/git`)
          break
        case 'plan': {
          const msg: Message = {
            id: uuid(),
            sessionId,
            role: 'assistant',
            contentJson: [{ type: 'text', text: '**Plan mode activated.** Claude will analyze without making changes.' }],
            createdAt: new Date().toISOString(),
          }
          useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
          break
        }
        case 'context': {
          const msgs = useChatStore.getState().messages
          const totalChars = msgs.reduce((sum, m) => {
            const text = m.contentJson?.map((b) => b.text || '').join('') || ''
            return sum + text.length
          }, 0)
          const msg: Message = {
            id: uuid(),
            sessionId,
            role: 'assistant',
            contentJson: [{
              type: 'text',
              text: `**Context**\n- Messages: ${msgs.length}\n- Approx chars: ${totalChars.toLocaleString()}\n- Model: ${currentSession?.model || 'unknown'}`,
            }],
            createdAt: new Date().toISOString(),
          }
          useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
          break
        }
        // ── Agent commands ───────────────────────────────
        case 'agents': {
          const msg: Message = {
            id: uuid(),
            sessionId,
            role: 'assistant',
            contentJson: [{
              type: 'text',
              text: '**Available Agent Commands:**\n- `/orchestrate` - Auto-pick agent for next message\n- `/agent-review` - Code Reviewer\n- `/security` - Security Analyst\n- `/debug` - Debugger\n- `/architect` - Architect\n- `/tdd` - TDD Guide\n- `/planner` - Planner\n- `/docs` - Documentation Writer\n- `/dismiss-agent` - Dismiss active agent',
            }],
            createdAt: new Date().toISOString(),
          }
          useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
          break
        }
        case 'orchestrate': {
          setAutoOrchestrate(true)
          const msg: Message = {
            id: uuid(),
            sessionId,
            role: 'assistant',
            contentJson: [{
              type: 'text',
              text: '**Auto-orchestration enabled.** The system will automatically select the best agent for your next message.',
            }],
            createdAt: new Date().toISOString(),
          }
          useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
          break
        }
        case 'agent-review':
          overrideAgent('code-reviewer')
          break
        case 'security':
          overrideAgent('security-analyst')
          break
        case 'debug':
          if (args) {
            overrideAgent('debugger')
            sendMessage(sessionId, args, 'debugger')
          } else {
            overrideAgent('debugger')
          }
          break
        case 'architect':
          overrideAgent('architect')
          break
        case 'tdd':
          overrideAgent('tdd-guide')
          break
        case 'planner':
          overrideAgent('planner')
          break
        case 'docs':
          overrideAgent('doc-writer')
          break
        case 'dismiss-agent': {
          dismissAgent()
          setAutoOrchestrate(false)
          const msg: Message = {
            id: uuid(),
            sessionId,
            role: 'assistant',
            contentJson: [{ type: 'text', text: '**Agent dismissed.** Using default model.' }],
            createdAt: new Date().toISOString(),
          }
          useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
          break
        }

        default: {
          // Check if it matches a custom skill trigger (DB skills)
          const matchedSkill = customSkills.find(
            (s) => s.trigger?.replace(/^\//, '') === name
          )
          // Also check catalog skills (available without import)
          const matchedCatalog = !matchedSkill
            ? catalogSkills.find((s) => s.trigger?.replace(/^\//, '') === name)
            : null
          const template = matchedSkill?.promptTemplate || matchedCatalog?.promptTemplate
          if (template) {
            // Expand the skill's prompt template with user args
            let prompt = template
            prompt = prompt.replace(/\$ARGUMENTS/g, args || '')
            prompt = prompt.replace(/\{\{args\}\}/g, args || '')
            prompt = prompt.replace(/\{\{input\}\}/g, args || '')
            prompt = prompt.replace(/\{\{context\}\}/g, args || '')
            prompt = prompt.replace(/\{\{code\}\}/g, args || '')
            prompt = prompt.replace(/\{\{query\}\}/g, args || '')
            sendMessage(sessionId, prompt, activeAgent?.id, undefined, undefined, effortLevel)
          } else {
            // Unknown command - send to Claude as a regular message
            sendMessage(sessionId, `/${name}${args ? ' ' + args : ''}`)
          }
          break
        }
      }
    },
    [sessionId, projectId, router, sendMessage, updateSessionModel, currentSession, overrideAgent, dismissAgent, customSkills, catalogSkills, activeAgent, effortLevel]
  )

  // Callbacks for ChatInput component (memoized to prevent re-renders)
  const handleChatInputSend = useCallback(async (payload: ChatInputSendPayload) => {
    const { content, images: imagesToSend } = payload

    // Check for auto-orchestration
    if (autoOrchestrate && !activeAgent) {
      try {
        const result = await api.post<{ agent: BuiltInAgent | null; reasoning: string }>('/api/agents/analyze', {
          message: content,
          projectId,
          sessionId,
        })
        if (result.agent) {
          setAgent(result.agent, result.reasoning)
          const modeToSend = planMode ? 'plan' : undefined
          await sendMessage(sessionId, content, result.agent.id, imagesToSend, modeToSend, effortLevel)
          return
        }
      } catch {
        // Fall through to regular send
      }
    }

    const modeToSend = planMode ? 'plan' : undefined
    await sendMessage(sessionId, content, activeAgent?.id, imagesToSend, modeToSend, effortLevel)
  }, [autoOrchestrate, projectId, sessionId, setAgent, planMode, sendMessage, activeAgent, effortLevel])

  const handleChatInputSlashCommand = useCallback((name: string, args: string) => {
    executeSlashCommand(name, args)
  }, [executeSlashCommand])

  const handleModelChange = useCallback(
    async (modelId: string) => {
      try {
        await updateSessionModel(sessionId, modelId)
        const model = MODELS.find((m) => m.id === modelId)
        // Show feedback
        const msg: Message = {
          id: uuid(),
          sessionId,
          role: 'assistant',
          contentJson: [{ type: 'text', text: `Model changed to **${model?.name || modelId}**` }],
          createdAt: new Date().toISOString(),
        }
        useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
      } catch (err) {
        console.error('Failed to change model:', err)
        const msg: Message = {
          id: uuid(),
          sessionId,
          role: 'assistant',
          contentJson: [{ type: 'text', text: `**Error:** Failed to change model. ${err instanceof Error ? err.message : ''}` }],
          createdAt: new Date().toISOString(),
        }
        useChatStore.setState((s) => ({ messages: [...s.messages, msg] }))
      }
    },
    [sessionId, updateSessionModel]
  )

  const handleEffortChange = useCallback(
    async (level: string) => {
      setEffortLevel(level)
      try {
        await api.patch(`/api/sessions/${sessionId}`, { effort: level })
      } catch (err) {
        console.error('Failed to persist effort level:', err)
      }
    },
    [sessionId]
  )

  const handleBranch = useCallback(
    async (fromMessageId: string) => {
      try {
        const newSession = await branchSession(sessionId, fromMessageId)
        router.push(`/projects/${projectId}/chat/${newSession.id}`)
      } catch (err) {
        console.error('Failed to branch session:', err)
      }
    },
    [sessionId, projectId, branchSession, router]
  )

  // Regenerate: delete last assistant + user message, re-send the user message
  const handleRegenerate = useCallback(async () => {
    const msgs = useChatStore.getState().messages
    if (msgs.length < 2) return
    // Find last assistant message
    let lastAssistantIdx = -1
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        lastAssistantIdx = i
        break
      }
    }
    if (lastAssistantIdx < 0) return
    // Find the user message right before it
    let lastUserIdx = -1
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserIdx = i
        break
      }
    }
    if (lastUserIdx < 0) return

    const userMsg = msgs[lastUserIdx]
    const userText = userMsg.contentJson?.find((b: ContentBlock) => b.type === 'text')?.text || ''
    if (!userText) return

    // Remove both messages from the store
    useChatStore.setState((s) => ({
      messages: s.messages.filter((_, i) => i !== lastUserIdx && i !== lastAssistantIdx),
    }))

    // Re-send the user message
    await sendMessage(sessionId, userText, activeAgent?.id, undefined, undefined, effortLevel)
  }, [sessionId, sendMessage, activeAgent, effortLevel])

  return (
    <SplitTerminal projectId={projectId}>
    <div className="flex h-full flex-col overflow-hidden">
      {/* Session header */}
      <div className="mb-2 flex items-start justify-between gap-2 border-b border-[var(--border)] pb-2 md:mb-3 md:items-center md:pb-3">
        <div className="flex min-w-0 items-start gap-2 md:items-center md:gap-3">
          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15 sm:flex">
            <svg className="h-4 w-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-[var(--foreground)]">
              {currentSession?.title || 'Chat Session'}
            </h1>
            {currentSession?.parentSessionId && parentSessionTitle && (
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/chat/${currentSession.parentSessionId}`)}
                className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l-6 6m0-6l6 6m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Branched from: {parentSessionTitle}
              </button>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] md:gap-2">
              <ModelSelector
                currentModel={currentSession?.model || 'claude-sonnet-4-6'}
                onSelect={handleModelChange}
              />
              <EffortSelector
                current={effortLevel}
                onSelect={handleEffortChange}
              />
              {/* Plan / Code mode toggle */}
              <button
                type="button"
                onClick={() => setPlanMode(!planMode)}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                  planMode
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-400'
                    : 'border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40'
                }`}
                title={planMode ? 'Switch to Code mode' : 'Switch to Plan mode'}
              >
                {planMode ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                )}
                {planMode ? 'Plan' : 'Code'}
              </button>
              {autoOrchestrate && (
                <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-purple-400">
                  auto-agent
                </span>
              )}
              {activeAgent && (
                <span
                  className="rounded px-1.5 py-0.5"
                  style={{ backgroundColor: activeAgent.color + '15', color: activeAgent.color }}
                >
                  {activeAgent.icon} {activeAgent.name}
                </span>
              )}
              {currentSession?.mode && !planMode && (
                <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5">
                  {currentSession.mode}
                </span>
              )}
              {isStreaming && (
                <span className="flex items-center gap-1 text-amber-400">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="font-mono">streaming...</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="relative flex shrink-0 items-center gap-1.5 md:gap-2">
          {/* Message search */}
          {showSearch && (
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-2 py-1">
              <svg className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchHighlightIndex(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchMatchArray.length > 0) {
                    setSearchHighlightIndex((i) => (i + 1) % searchMatchArray.length)
                  }
                  if (e.key === 'Escape') {
                    setShowSearch(false)
                    setSearchQuery('')
                    setSearchHighlightIndex(-1)
                  }
                }}
                placeholder="Search messages..."
                className="w-28 border-none bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] md:w-40"
                autoFocus
              />
              {searchQuery && (
                <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">
                  {searchMatchIds.size > 0 ? `${Math.min(searchHighlightIndex + 1, searchMatchArray.length)}/${searchMatchArray.length}` : '0/0'}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false)
                  setSearchQuery('')
                  setSearchHighlightIndex(-1)
                }}
                className="ml-0.5 rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {!showSearch && messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-2 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)] md:gap-1.5 md:px-3 md:py-1.5"
              title="Search messages"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
          <span className="hidden md:inline"><TaskPanel projectId={projectId} sessionId={sessionId} /></span>
          {messages.length > 0 && !isStreaming && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-2 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)] md:gap-1.5 md:px-3 md:py-1.5"
                title="Export session"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export</span>
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleExport('markdown')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--foreground)] hover:bg-[var(--secondary)]"
                    >
                      <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export as Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('json')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--foreground)] hover:bg-[var(--secondary)]"
                    >
                      <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      Export as JSON
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {messages.length > 0 && !isStreaming && (
            <button
              type="button"
              onClick={() => setShowPlayback(true)}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-2 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)] md:gap-1.5 md:px-3 md:py-1.5"
              title="Replay session"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Replay</span>
            </button>
          )}
          {isStreaming && (
            <button
              onClick={() => stopGeneration(sessionId)}
              className="flex items-center gap-1 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-2 py-1 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/20 md:gap-1.5 md:px-3 md:py-1.5"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* Budget warning banner */}
      {budgetWarning && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>
              {budgetWarning.type === 'daily' ? 'Daily' : 'Monthly'} budget at{' '}
              <strong>{budgetWarning.percentUsed.toFixed(0)}%</strong>{' '}
              (${budgetWarning.currentSpend.toFixed(2)} / ${budgetWarning.limit.toFixed(2)})
            </span>
          </div>
          <button
            type="button"
            onClick={dismissBudgetWarning}
            className="ml-2 shrink-0 rounded p-0.5 hover:bg-yellow-500/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth"
      >
        {/* Loading more messages indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 py-3">
            <svg className="h-4 w-4 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-[var(--muted-foreground)]">Loading earlier messages...</span>
          </div>
        )}
        {hasMore && !loadingMore && messages.length > 0 && (
          <div className="flex justify-center py-2">
            <span className="text-[10px] text-[var(--muted-foreground)]">Scroll up for more</span>
          </div>
        )}

        {messages.length === 0 && !isStreaming && (
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-lg px-4">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                  <svg className="h-8 w-8 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <h3 className="text-base font-medium text-[var(--foreground)]">
                  Start a conversation
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Choose a template or type a message
                </p>
              </div>
              {/* Starter prompt templates */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Fix a bug', prompt: 'Help me fix a bug. ' },
                  { icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', title: 'Add a feature', prompt: 'Help me add a new feature. ' },
                  { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', title: 'Write tests', prompt: 'Write tests for ' },
                  { icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', title: 'Refactor code', prompt: 'Refactor the code in ' },
                  { icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z', title: 'Review changes', prompt: 'Review the recent changes and suggest improvements.' },
                  { icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Explain code', prompt: 'Explain how this code works: ' },
                ].map((tmpl) => (
                  <button
                    key={tmpl.title}
                    type="button"
                    onClick={() => {
                      // @ts-expect-error - ChatInput exposes via window
                      window.__chatInput?.setInput(tmpl.prompt)
                      // @ts-expect-error - ChatInput exposes via window
                      window.__chatInput?.focus()
                    }}
                    className="group flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--accent)]/50 hover:shadow-sm"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/10 transition-colors group-hover:bg-[var(--primary)]/20">
                      <svg className="h-4 w-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={tmpl.icon} />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-[var(--foreground)]">{tmpl.title}</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-[10px] text-[var(--muted-foreground)]">
                Use <span className="font-mono text-[var(--primary)]">/</span> for commands or <span className="font-mono text-[var(--primary)]">@</span> to mention files
              </p>
            </div>
          </div>
        )}

        <div className="divide-y divide-[var(--border)]/30">
          {messages.map((msg, msgIndex) => {
            const isSearchMatch = searchQuery && searchMatchIds.has(msg.id)
            const isSearchActive = searchHighlightIndex >= 0 && searchMatchArray[searchHighlightIndex] === msg.id
            // Check if this is the LAST assistant message for regenerate button
            const isLastAssistant = !isStreaming && msg.role === 'assistant' && msgIndex === messages.length - 1

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`group/branch relative transition-colors ${
                  isSearchActive
                    ? 'bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30 rounded-lg'
                    : isSearchMatch
                    ? 'bg-[var(--accent)]/30'
                    : ''
                }`}
              >
                {msg.role === 'user' ? (
                  <UserMessageView msg={msg} />
                ) : (
                  <AssistantMessageView msg={msg} />
                )}
                {/* Branch from here button */}
                <button
                  type="button"
                  onClick={() => handleBranch(msg.id)}
                  title="Branch from here"
                  className="absolute right-2 top-3 flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)] opacity-0 transition-opacity hover:border-[var(--primary)]/40 hover:text-[var(--primary)] group-hover/branch:opacity-100"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 103 3H6m0-3h12a3 3 0 013-3V6a3 3 0 00-3-3H9a3 3 0 00-3 3v6" />
                  </svg>
                  <span className="hidden sm:inline">Branch</span>
                </button>
                {/* Regenerate button on last assistant message */}
                {isLastAssistant && (
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    title="Regenerate response"
                    className="absolute right-2 bottom-2 flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)] opacity-0 transition-opacity hover:border-[var(--primary)]/40 hover:text-[var(--primary)] group-hover/branch:opacity-100"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Regenerate</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Streaming content */}
        {isStreaming && <StreamingAssistantView />}

        {/* Spacer for scroll */}
        <div className="h-4" />

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            type="button"
            onClick={forceScrollToBottom}
            className="sticky bottom-4 left-[calc(100%-3rem)] z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-lg transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Scroll to bottom"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Input area - safe-area bottom padding for mobile notch devices */}
      <div className="shrink-0 border-t border-[var(--border)] pt-2 md:pt-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Agent orchestration panel */}
        <AgentOrchestrationPanel
          activeAgent={activeAgent}
          reasoning={agentReasoning}
          onDismiss={() => {
            dismissAgent()
            setAutoOrchestrate(false)
          }}
          onOverride={overrideAgent}
          isVisible={!!activeAgent}
        />

        {/* Custom agent selector */}
        {!activeAgent && customAgents.length > 0 && (
          <div className="relative mb-2">
            <button
              type="button"
              onClick={() => setShowCustomAgentPicker(!showCustomAgentPicker)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)]/50 px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Select Agent ({customAgents.length})
              <svg className={`h-3 w-3 transition-transform ${showCustomAgentPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCustomAgentPicker && (
              <div className="absolute bottom-full left-0 z-20 mb-1 max-h-52 w-72 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
                <div className="sticky top-0 bg-[var(--card)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Your Agents
                </div>
                {customAgents.filter(a => a.isActive !== false).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setAgent(
                        {
                          id: agent.id,
                          name: agent.name,
                          role: agent.role || 'general',
                          description: agent.description || '',
                          systemPrompt: agent.systemPrompt || '',
                          model: agent.model || 'claude-sonnet-4-6',
                          icon: agent.icon || '🤖',
                          color: agent.color || '#6366f1',
                        },
                        `Custom agent: ${agent.name}`
                      )
                      setShowCustomAgentPicker(false)
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
                      style={{ backgroundColor: (agent.color || '#6366f1') + '20' }}
                    >
                      {agent.icon || '🤖'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-[var(--foreground)]">
                        {agent.name}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--muted-foreground)]">
                        {agent.description || agent.role || 'Custom agent'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <ChatInput
          sessionId={sessionId}
          isStreaming={isStreaming}
          skillCommands={skillCommands}
          projectFiles={projectFiles}
          onSend={handleChatInputSend}
          onSlashCommand={handleChatInputSlashCommand}
        />
      </div>

      {/* Permission dialog for tool approvals */}
      <PermissionDialog />

      {/* Session playback overlay */}
      {showPlayback && (
        <SessionPlayback
          messages={messages}
          onClose={() => setShowPlayback(false)}
        />
      )}
    </div>
    </SplitTerminal>
  )
}
