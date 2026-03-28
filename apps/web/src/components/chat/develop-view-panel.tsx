'use client'

import { useState, useMemo, useCallback } from 'react'
import type { Message, ToolCall } from '@axy/shared'
import type { StreamingToolCall } from '@/stores/chat.store'
import { DiffViewer, extractDiffData, isFileEditTool } from '@/components/chat/diff-viewer'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface FileChange {
  path: string
  action: 'created' | 'edited' | 'read' | 'deleted'
  toolName: string
  toolInput: Record<string, unknown>
  messageId: string
  timestamp: string
  durationMs?: number
}

interface ActivityEntry {
  id: string
  type: 'tool' | 'command' | 'search' | 'file'
  name: string
  detail: string
  timestamp: string
  durationMs?: number
  status: 'success' | 'error' | 'running'
  messageId: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  toolError?: string
}

type Tab = 'files' | 'activity'

// ────────────────────────────────────────────────────────────
// Tool classification helpers
// ────────────────────────────────────────────────────────────
function getFileAction(toolName: string): FileChange['action'] | null {
  const lower = toolName.toLowerCase()
  if (lower.includes('write') || lower.includes('create')) return 'created'
  if (lower.includes('edit') || lower.includes('replace') || lower.includes('patch') || lower.includes('insert') || lower.includes('str_replace')) return 'edited'
  if (lower.includes('read') || lower.includes('cat') || lower.includes('head') || lower.includes('view')) return 'read'
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('rm')) return 'deleted'
  return null
}

function getFilePath(toolName: string, input: Record<string, unknown>): string | null {
  // Try common parameter names for file paths
  for (const key of ['file_path', 'path', 'filename', 'target_file', 'filePath', 'file']) {
    if (typeof input[key] === 'string') return input[key] as string
  }
  // Glob/Grep patterns
  if (typeof input['pattern'] === 'string' && toolName.toLowerCase().includes('glob')) {
    return input['pattern'] as string
  }
  return null
}

function getToolCategory(name: string): ActivityEntry['type'] {
  const lower = name.toLowerCase()
  if (lower.includes('bash') || lower.includes('shell') || lower.includes('exec') || lower.includes('command')) return 'command'
  if (lower.includes('grep') || lower.includes('glob') || lower.includes('search') || lower.includes('find') || lower.includes('web')) return 'search'
  if (isFileEditTool(name) || lower.includes('read') || lower.includes('list')) return 'file'
  return 'tool'
}

function getToolIcon(type: ActivityEntry['type']) {
  switch (type) {
    case 'command': return 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
    case 'search': return 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
    case 'file': return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    default: return 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
  }
}

function getToolColor(type: ActivityEntry['type']) {
  switch (type) {
    case 'command': return { bg: 'rgba(52,211,153,0.1)', text: '#34d399', border: 'rgba(52,211,153,0.2)' }
    case 'search': return { bg: 'rgba(129,140,248,0.1)', text: '#818cf8', border: 'rgba(129,140,248,0.2)' }
    case 'file': return { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' }
    default: return { bg: 'rgba(189,157,255,0.1)', text: '#bd9dff', border: 'rgba(189,157,255,0.2)' }
  }
}

function getFileActionColor(action: FileChange['action']) {
  switch (action) {
    case 'created': return { bg: 'rgba(52,211,153,0.15)', text: '#34d399', label: 'A' }
    case 'edited': return { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'M' }
    case 'read': return { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa', label: 'R' }
    case 'deleted': return { bg: 'rgba(248,113,113,0.15)', text: '#f87171', label: 'D' }
  }
}

function formatDuration(ms?: number) {
  if (!ms) return ''
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function shortenPath(p: string) {
  // Show last 2-3 parts of path
  const parts = p.replace(/^\/+/, '').split('/')
  if (parts.length <= 3) return parts.join('/')
  return '.../' + parts.slice(-3).join('/')
}

// ────────────────────────────────────────────────────────────
// Extract data from messages
// ────────────────────────────────────────────────────────────
function extractFileChanges(messages: Message[]): FileChange[] {
  const changes: FileChange[] = []
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue
    const tools = msg.toolCallsJson || []
    for (const tool of tools) {
      const action = getFileAction(tool.name)
      const path = getFilePath(tool.name, tool.input || {})
      if (action && path) {
        changes.push({
          path,
          action,
          toolName: tool.name,
          toolInput: tool.input || {},
          messageId: msg.id,
          timestamp: msg.createdAt,
          durationMs: tool.durationMs,
        })
      }
    }
  }
  return changes
}

function extractActivity(messages: Message[], streamingTools: StreamingToolCall[]): ActivityEntry[] {
  const entries: ActivityEntry[] = []

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue
    const tools = msg.toolCallsJson || []
    for (const tool of tools) {
      const category = getToolCategory(tool.name)
      const filePath = getFilePath(tool.name, tool.input || {})
      entries.push({
        id: tool.id || `${msg.id}-${tool.name}`,
        type: category,
        name: tool.name,
        detail: filePath || (tool.input?.command as string) || (tool.input?.pattern as string) || '',
        timestamp: msg.createdAt,
        durationMs: tool.durationMs,
        status: tool.error ? 'error' : 'success',
        messageId: msg.id,
        toolInput: tool.input,
        toolResult: tool.result,
        toolError: tool.error,
      })
    }
  }

  // Add streaming (running) tools
  for (const tool of streamingTools) {
    entries.push({
      id: tool.id,
      type: getToolCategory(tool.name),
      name: tool.name,
      detail: getFilePath(tool.name, tool.input || {}) || (tool.input?.command as string) || '',
      timestamp: new Date(tool.startedAt).toISOString(),
      durationMs: tool.durationMs,
      status: tool.isRunning ? 'running' : (tool.error ? 'error' : 'success'),
      messageId: '',
      toolInput: tool.input,
      toolResult: tool.result,
      toolError: tool.error,
    })
  }

  return entries
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export interface DevelopViewPanelProps {
  messages: Message[]
  streamingToolCalls: StreamingToolCall[]
  isStreaming: boolean
}

export function DevelopViewPanel({ messages, streamingToolCalls, isStreaming }: DevelopViewPanelProps) {
  const [tab, setTab] = useState<Tab>('files')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)

  // Extract data
  const fileChanges = useMemo(() => extractFileChanges(messages), [messages])
  const activity = useMemo(() => extractActivity(messages, streamingToolCalls), [messages, streamingToolCalls])

  // Group files by path (latest action wins), excluding reads
  const changedFiles = useMemo(() => {
    const map = new Map<string, FileChange>()
    for (const change of fileChanges) {
      if (change.action === 'read') continue // Skip reads for changed files
      map.set(change.path, change) // Latest wins
    }
    return Array.from(map.values()).reverse()
  }, [fileChanges])

  // All files including reads
  const allFiles = useMemo(() => {
    const map = new Map<string, FileChange>()
    for (const change of fileChanges) {
      map.set(change.path, change)
    }
    return Array.from(map.values()).reverse()
  }, [fileChanges])

  // Stats
  const stats = useMemo(() => {
    const created = changedFiles.filter((f) => f.action === 'created').length
    const edited = changedFiles.filter((f) => f.action === 'edited').length
    const deleted = changedFiles.filter((f) => f.action === 'deleted').length
    return { created, edited, deleted, total: created + edited + deleted }
  }, [changedFiles])

  // Get diff for selected file
  const selectedFileDiff = useMemo(() => {
    if (!selectedFile) return null
    const change = fileChanges.filter((f) => f.path === selectedFile).pop()
    if (!change) return null
    return extractDiffData(change.toolName, change.toolInput)
  }, [selectedFile, fileChanges])

  const toggleActivity = useCallback((id: string) => {
    setExpandedActivity((prev) => (prev === id ? null : id))
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header with tabs */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-[rgba(72,72,71,0.15)] px-1">
        <button
          onClick={() => setTab('files')}
          className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors ${
            tab === 'files' ? 'text-white' : 'text-[#767575] hover:text-[#adaaaa]'
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          Files
          {stats.total > 0 && (
            <span className="rounded-full bg-[var(--primary)]/20 px-1.5 py-0.5 text-[9px] font-bold text-[var(--primary)]">
              {stats.total}
            </span>
          )}
          {tab === 'files' && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[var(--primary)]" />}
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors ${
            tab === 'activity' ? 'text-white' : 'text-[#767575] hover:text-[#adaaaa]'
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          Activity
          {isStreaming && (
            <span className="flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
          )}
          {tab === 'activity' && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[var(--primary)]" />}
        </button>
      </div>

      {/* Content */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {tab === 'files' && (
          <div className="flex h-full flex-col">
            {/* Stats bar */}
            {stats.total > 0 && (
              <div className="flex items-center gap-3 border-b border-[rgba(72,72,71,0.1)] px-3 py-2">
                {stats.created > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                    +{stats.created} created
                  </span>
                )}
                {stats.edited > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
                    ~{stats.edited} modified
                  </span>
                )}
                {stats.deleted > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-red-400">
                    -{stats.deleted} deleted
                  </span>
                )}
              </div>
            )}

            {/* File list */}
            {changedFiles.length === 0 && !isStreaming ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(189,157,255,0.08)]">
                  <svg className="h-5 w-5 text-[#767575]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-xs text-[#767575]">No file changes yet</p>
                <p className="mt-1 text-[10px] text-[#555]">Changes will appear here as Claude edits files</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(72,72,71,0.08)]">
                {changedFiles.map((file) => {
                  const actionColor = getFileActionColor(file.action)
                  const isSelected = selectedFile === file.path
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(isSelected ? null : file.path)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[rgba(189,157,255,0.04)] ${
                        isSelected ? 'bg-[rgba(189,157,255,0.08)]' : ''
                      }`}
                    >
                      <span
                        className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded text-[9px] font-bold"
                        style={{ background: actionColor.bg, color: actionColor.text }}
                      >
                        {actionColor.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#e0e0e0]">
                        {shortenPath(file.path)}
                      </span>
                      {file.durationMs && (
                        <span className="shrink-0 text-[9px] text-[#555]">{formatDuration(file.durationMs)}</span>
                      )}
                      <svg className={`h-3 w-3 shrink-0 text-[#555] transition-transform ${isSelected ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Inline diff viewer for selected file */}
            {selectedFile && selectedFileDiff && (
              <div className="border-t border-[rgba(72,72,71,0.15)]">
                <div className="flex items-center gap-2 bg-[#131313] px-3 py-2">
                  <svg className="h-3.5 w-3.5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                  <span className="flex-1 truncate font-mono text-[11px] font-medium text-white">{shortenPath(selectedFile)}</span>
                  <button onClick={() => setSelectedFile(null)} className="rounded p-0.5 text-[#767575] hover:text-white">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <DiffViewer
                  filename={selectedFileDiff.filename}
                  oldContent={selectedFileDiff.oldContent}
                  newContent={selectedFileDiff.newContent}
                />
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="divide-y divide-[rgba(72,72,71,0.06)]">
            {activity.length === 0 && !isStreaming ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(189,157,255,0.08)]">
                  <svg className="h-5 w-5 text-[#767575]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                </div>
                <p className="text-xs text-[#767575]">No activity yet</p>
                <p className="mt-1 text-[10px] text-[#555]">Tool executions will appear here</p>
              </div>
            ) : (
              [...activity].reverse().map((entry) => {
                const color = getToolColor(entry.type)
                const isExpanded = expandedActivity === entry.id
                return (
                  <div key={entry.id}>
                    <button
                      onClick={() => toggleActivity(entry.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[rgba(189,157,255,0.04)]"
                    >
                      {/* Status indicator */}
                      {entry.status === 'running' ? (
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                          <svg className="h-3.5 w-3.5 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        </div>
                      ) : (
                        <div
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                          style={{ background: entry.status === 'error' ? 'rgba(248,113,113,0.15)' : color.bg }}
                        >
                          <svg className="h-2.5 w-2.5" style={{ color: entry.status === 'error' ? '#f87171' : color.text }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={getToolIcon(entry.type)} />
                          </svg>
                        </div>
                      )}

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold" style={{ color: color.text }}>{entry.name}</span>
                          {entry.durationMs && (
                            <span className="text-[9px] text-[#555]">{formatDuration(entry.durationMs)}</span>
                          )}
                        </div>
                        {entry.detail && (
                          <p className="truncate font-mono text-[10px] text-[#767575]">{shortenPath(entry.detail)}</p>
                        )}
                      </div>

                      {/* Expand chevron */}
                      <svg className={`h-3 w-3 shrink-0 text-[#555] transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="bg-[#0d0d0d] px-3 py-2">
                        {entry.toolInput && Object.keys(entry.toolInput).length > 0 && (
                          <div className="mb-2">
                            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#555]">Input</p>
                            <pre className="custom-scrollbar max-h-40 overflow-auto rounded bg-[#1a1a1a] p-2 font-mono text-[10px] text-[#adaaaa]">
                              {JSON.stringify(entry.toolInput, null, 2)}
                            </pre>
                          </div>
                        )}
                        {entry.toolResult && (
                          <div className="mb-2">
                            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#555]">Output</p>
                            <pre className="custom-scrollbar max-h-40 overflow-auto rounded bg-[#1a1a1a] p-2 font-mono text-[10px] text-[#adaaaa]">
                              {entry.toolResult.length > 2000 ? entry.toolResult.slice(0, 2000) + '...' : entry.toolResult}
                            </pre>
                          </div>
                        )}
                        {entry.toolError && (
                          <div>
                            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-red-400">Error</p>
                            <pre className="custom-scrollbar max-h-40 overflow-auto rounded bg-red-500/5 p-2 font-mono text-[10px] text-red-400">
                              {entry.toolError}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
