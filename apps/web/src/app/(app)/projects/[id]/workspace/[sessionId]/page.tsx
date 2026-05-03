'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { api } from '@/lib/api-client'
import type { FileNode } from '@axy/shared'
import { WorkspaceActivityBar, type ActivityView } from '@/components/workspace/workspace-activity-bar'
import { WorkspaceFileTree } from '@/components/workspace/workspace-file-tree'
import { WorkspaceChatList } from '@/components/workspace/workspace-chat-list'
import { WorkspaceChatPanel } from '@/components/workspace/workspace-chat-panel'
import { EmbeddedTerminal } from '@/components/terminal/embedded-terminal'
import { useChatStore } from '@/stores/chat.store'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface OpenTab {
  path: string
  name: string
  content: string
  originalContent: string
  language: string
}

const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  json: 'json', md: 'markdown', mdx: 'markdown', py: 'python',
  css: 'css', scss: 'scss', html: 'html', xml: 'xml', svg: 'xml',
  yml: 'yaml', yaml: 'yaml', toml: 'ini', rs: 'rust', go: 'go',
  sql: 'sql', sh: 'shell', bash: 'shell', kt: 'kotlin', java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', cs: 'csharp', rb: 'ruby', php: 'php',
  swift: 'swift', lua: 'lua', dart: 'dart', vue: 'html', env: 'ini',
}

function detectLanguage(name: string): string {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile'
  if (lower === 'makefile') return 'makefile'
  const dot = name.lastIndexOf('.')
  const ext = dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
  return EXT_LANG[ext] || 'plaintext'
}

const BINARY_EXTS = new Set([
  'png','jpg','jpeg','gif','ico','bmp','webp','avif',
  'woff','woff2','ttf','otf','zip','tar','gz','rar','7z',
  'pdf','mp3','mp4','wav','exe','dll','so','dylib',
])

function isBinary(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return false
  return BINARY_EXTS.has(name.slice(dot + 1).toLowerCase())
}

export default function WorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const sessionId = params.sessionId as string

  // Layout state (persisted in localStorage)
  const [activityView, setActivityView] = useState<ActivityView>(() => {
    if (typeof window === 'undefined') return 'files'
    return (localStorage.getItem('axy-ws-activity') as ActivityView) || 'files'
  })
  const [sidePanelOpen, setSidePanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('axy-ws-side-open') !== 'false'
  })
  const [chatPanelOpen, setChatPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('axy-ws-chat-open') !== 'false'
  })
  const [terminalOpen, setTerminalOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('axy-ws-terminal-open') === 'true'
  })

  // File tree
  const [tree, setTree] = useState<FileNode[]>([])
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingTree, setLoadingTree] = useState(true)

  // Persist UI state
  useEffect(() => { try { localStorage.setItem('axy-ws-activity', activityView) } catch {} }, [activityView])
  useEffect(() => { try { localStorage.setItem('axy-ws-side-open', String(sidePanelOpen)) } catch {} }, [sidePanelOpen])
  useEffect(() => { try { localStorage.setItem('axy-ws-chat-open', String(chatPanelOpen)) } catch {} }, [chatPanelOpen])
  useEffect(() => { try { localStorage.setItem('axy-ws-terminal-open', String(terminalOpen)) } catch {} }, [terminalOpen])

  // Load file tree
  const loadTree = useCallback(async () => {
    try {
      setLoadingTree(true)
      const data = await api.get<FileNode[]>(`/api/files/projects/${projectId}`)
      setTree(data)
    } catch (e) {
      console.error('Failed to load tree', e)
    } finally {
      setLoadingTree(false)
    }
  }, [projectId])

  useEffect(() => { loadTree() }, [loadTree])

  // File select handler
  const handleSelectFile = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'file') return
      // Already open?
      const existing = openTabs.find((t) => t.path === node.path)
      if (existing) {
        setActiveTabPath(node.path)
        return
      }
      if (isBinary(node.name)) {
        // Don't open binaries in editor
        return
      }
      try {
        const res = await api.get<{ content: string }>(
          `/api/files/projects/${projectId}/read?path=${encodeURIComponent(node.path)}`
        )
        const language = detectLanguage(node.name)
        const tab: OpenTab = {
          path: node.path,
          name: node.name,
          content: res.content,
          originalContent: res.content,
          language,
        }
        setOpenTabs((prev) => [...prev, tab])
        setActiveTabPath(node.path)
      } catch (e) {
        console.error('Failed to read file', e)
      }
    },
    [openTabs, projectId]
  )

  // Active tab
  const activeTab = useMemo(
    () => openTabs.find((t) => t.path === activeTabPath) || null,
    [openTabs, activeTabPath]
  )

  // Edit content
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeTabPath) return
      setOpenTabs((prev) =>
        prev.map((t) => (t.path === activeTabPath ? { ...t, content: value || '' } : t))
      )
    },
    [activeTabPath]
  )

  // Save active tab
  const handleSave = useCallback(async () => {
    if (!activeTab) return
    if (activeTab.content === activeTab.originalContent) return
    try {
      setSaving(true)
      await api.put(`/api/files/projects/${projectId}/write`, {
        path: activeTab.path,
        content: activeTab.content,
      })
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path ? { ...t, originalContent: t.content } : t
        )
      )
    } catch (e) {
      console.error('Save failed', e)
    } finally {
      setSaving(false)
    }
  }, [activeTab, projectId])

  // Close tab
  const closeTab = useCallback(
    (path: string) => {
      setOpenTabs((prev) => prev.filter((t) => t.path !== path))
      if (activeTabPath === path) {
        const remaining = openTabs.filter((t) => t.path !== path)
        setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1].path : null)
      }
    },
    [openTabs, activeTabPath]
  )

  // Save shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  // Status bar info
  const currentSession = useChatStore((s) => s.currentSession)
  const isStreaming = useChatStore((s) => s._streams[sessionId]?.isStreaming || false)
  const totalTokens = currentSession
    ? (currentSession.totalInputTokens || 0) + (currentSession.totalOutputTokens || 0)
    : 0

  return (
    <div className="flex h-full flex-col gap-1.5 p-1.5" style={{ background: 'var(--surface-lowest)' }}>
      {/* Top bar with action buttons */}
      <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-mid)] px-3 py-1.5">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-white/5 hover:text-[var(--foreground)]"
          title="Back to project"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--foreground)]">Workspace</span>
        <span className="text-[10px] text-[var(--muted-foreground)]">— IDE mode</span>

        <div className="flex-1" />

        {/* Toggle terminal */}
        <button
          onClick={() => setTerminalOpen(!terminalOpen)}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
            terminalOpen
              ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
              : 'text-[var(--muted-foreground)] hover:bg-white/5 hover:text-[var(--foreground)]'
          }`}
          title="Toggle terminal"
        >
          <span className="flex items-center gap-1">
            <span className="font-mono">$_</span>
            <span>terminal</span>
          </span>
        </button>

        {/* Toggle chat */}
        <button
          onClick={() => setChatPanelOpen(!chatPanelOpen)}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
            chatPanelOpen
              ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
              : 'text-[var(--muted-foreground)] hover:bg-white/5 hover:text-[var(--foreground)]'
          }`}
          title="Toggle chat"
        >
          chat
        </button>

        {/* Switch to full chat view */}
        <button
          onClick={() => router.push(`/projects/${projectId}/chat/${sessionId}`)}
          className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
          title="Switch to full chat view"
        >
          full chat →
        </button>
      </div>

      {/* Main 3-column layout */}
      <div className="flex min-h-0 flex-1 gap-1.5">
        {/* Activity Bar (island) */}
        <div className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-mid)]">
          <WorkspaceActivityBar
            active={activityView}
            onSelect={setActivityView}
            onTogglePanel={() => setSidePanelOpen(!sidePanelOpen)}
            panelOpen={sidePanelOpen}
          />
        </div>

        {/* Side Panel (island) — files / chats / search */}
        {sidePanelOpen && (
          <div className="hidden w-60 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-mid)] md:block">
            {activityView === 'files' && (
              <WorkspaceFileTree
                tree={tree}
                selectedPath={activeTabPath}
                onSelect={handleSelectFile}
                onRefresh={loadTree}
              />
            )}
            {activityView === 'chat' && (
              <WorkspaceChatList projectId={projectId} currentSessionId={sessionId} />
            )}
            {activityView === 'search' && (
              <div className="px-3 py-3 text-[11px] text-[var(--muted-foreground)]">
                <p className="mb-2 font-bold uppercase tracking-wider">Search</p>
                <p>Coming soon — for now use Cmd/Ctrl+K from full chat view.</p>
              </div>
            )}
            {activityView === 'git' && (
              <div className="px-3 py-3 text-[11px] text-[var(--muted-foreground)]">
                <p className="mb-2 font-bold uppercase tracking-wider">Source Control</p>
                <a
                  href={`/projects/${projectId}/git`}
                  className="text-[var(--primary)] hover:underline"
                >
                  Open Git tab →
                </a>
              </div>
            )}
            {activityView === 'tasks' && (
              <div className="px-3 py-3 text-[11px] text-[var(--muted-foreground)]">
                <p className="mb-2 font-bold uppercase tracking-wider">Tasks</p>
                <a
                  href={`/projects/${projectId}/tasks`}
                  className="text-[var(--primary)] hover:underline"
                >
                  Open Tasks tab →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Center: Editor + tabs + terminal */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Editor island */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-mid)]">
            {/* Tab bar */}
            <div className="flex shrink-0 items-center overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-low)]">
              {openTabs.length === 0 ? (
                <div className="px-3 py-1.5 text-[10px] text-[var(--muted-foreground)]">
                  No file open · select a file from the explorer
                </div>
              ) : (
                openTabs.map((tab) => {
                  const isActive = tab.path === activeTabPath
                  const isDirty = tab.content !== tab.originalContent
                  return (
                    <div
                      key={tab.path}
                      onClick={() => setActiveTabPath(tab.path)}
                      className={`group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-[var(--border)] px-3 py-1.5 text-[11px] transition-colors ${
                        isActive
                          ? 'bg-[var(--surface-mid)] text-[var(--foreground)]'
                          : 'text-[var(--muted-foreground)] hover:bg-white/5'
                      }`}
                      style={{
                        borderTop: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                      }}
                    >
                      <span>{tab.name}</span>
                      {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(tab.path)
                        }}
                        className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Editor body */}
            <div className="min-h-0 flex-1">
              {activeTab ? (
                <MonacoEditor
                  height="100%"
                  language={activeTab.language}
                  value={activeTab.content}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, monospace',
                    minimap: { enabled: true, scale: 1 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    renderLineHighlight: 'gutter',
                    padding: { top: 12, bottom: 12 },
                    automaticLayout: true,
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-3 text-4xl opacity-20">📂</div>
                    <p className="mb-1 text-sm text-[var(--muted-foreground)]">No file selected</p>
                    <p className="text-[11px] text-[var(--muted-foreground)]/60">
                      Pick a file from the explorer or ask Claude to open one
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Terminal island (collapsible) */}
          {terminalOpen && (
            <div className="h-64 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-mid)]">
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Terminal
                  </span>
                  <button
                    onClick={() => setTerminalOpen(false)}
                    className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-white/5 hover:text-[var(--foreground)]"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <EmbeddedTerminal projectId={projectId} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat panel (island) */}
        {chatPanelOpen && (
          <div className="hidden w-96 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-mid)] lg:block">
            <WorkspaceChatPanel sessionId={sessionId} projectId={projectId} />
          </div>
        )}
      </div>

      {/* Status bar (island) */}
      <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-mid)] px-3 py-1 text-[10px] text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${isStreaming ? 'animate-pulse bg-amber-400' : 'bg-green-400'}`} />
          {isStreaming ? 'Claude is working...' : 'Ready'}
        </span>
        <span className="opacity-40">·</span>
        <span>{currentSession?.model?.replace('claude-', '') || 'sonnet-4-6'}</span>
        {activeTab && (
          <>
            <span className="opacity-40">·</span>
            <span>{activeTab.language}</span>
            <span className="opacity-40">·</span>
            <span className="font-mono">{activeTab.path}</span>
            {activeTab.content !== activeTab.originalContent && (
              <span className="text-amber-400">● modified</span>
            )}
            {saving && <span className="text-[var(--primary)]">saving...</span>}
          </>
        )}
        <div className="flex-1" />
        <span>{totalTokens.toLocaleString()} tokens</span>
        <span className="opacity-40">·</span>
        <span>UTF-8</span>
      </div>
    </div>
  )
}
