'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// --- Types ---

interface CommandItem {
  id: string
  label: string
  category: string
  icon?: string
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  projectId?: string
}

// --- SVG icon paths (heroicons outline, 24x24 viewBox) ---

const ICONS = {
  arrow: 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3',
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  zap: 'M13 10V3L4 14h7v7l9-11h-7z',
  cpu: 'M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
}

const CATEGORY_ICONS: Record<string, string> = {
  Navigation: ICONS.arrow,
  'Project Actions': ICONS.folder,
  'Quick Actions': ICONS.zap,
  'Model Switch': ICONS.cpu,
}

const CATEGORY_ORDER = ['Navigation', 'Project Actions', 'Quick Actions', 'Model Switch']

// --- Fuzzy match: all chars of query appear in order in target ---

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

// --- Component ---

export function CommandPalette({ projectId }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const router = useRouter()
  const pathname = usePathname()

  // Derive projectId from URL if not provided via props
  const resolvedProjectId = useMemo(() => {
    if (projectId) return projectId
    const match = pathname.match(/^\/projects\/([^/]+)/)
    return match?.[1] ?? undefined
  }, [projectId, pathname])

  // Build command list
  const allItems = useMemo<CommandItem[]>(() => {
    const close = () => setOpen(false)

    const nav = (path: string) => () => {
      router.push(path)
      close()
    }

    const items: CommandItem[] = [
      // Navigation
      { id: 'nav-dashboard', label: 'Go to Dashboard', category: 'Navigation', shortcut: '', action: nav('/dashboard') },
      { id: 'nav-projects', label: 'Go to Projects', category: 'Navigation', shortcut: '', action: nav('/projects') },
      { id: 'nav-agents', label: 'Go to Agents', category: 'Navigation', shortcut: '', action: nav('/agents') },
      { id: 'nav-skills', label: 'Go to Skills', category: 'Navigation', shortcut: '', action: nav('/skills') },
      { id: 'nav-settings', label: 'Go to Settings', category: 'Navigation', shortcut: '', action: nav('/settings') },
    ]

    // Project Actions (only if in a project context)
    if (resolvedProjectId) {
      const p = `/projects/${resolvedProjectId}`
      items.push(
        { id: 'proj-chat', label: 'Open Chat', category: 'Project Actions', shortcut: 'Ctrl+Shift+C', action: nav(`${p}/chat`) },
        { id: 'proj-terminal', label: 'Open Terminal', category: 'Project Actions', shortcut: 'Ctrl+T', action: nav(`${p}/terminal`) },
        { id: 'proj-files', label: 'Open Files', category: 'Project Actions', shortcut: 'Ctrl+Shift+F', action: nav(`${p}/files`) },
        { id: 'proj-git', label: 'Open Git', category: 'Project Actions', shortcut: 'Ctrl+Shift+G', action: nav(`${p}/git`) },
        { id: 'proj-notes', label: 'Open Notes', category: 'Project Actions', shortcut: '', action: nav(`${p}/notes`) },
        { id: 'proj-mcp', label: 'Open MCP Servers', category: 'Project Actions', shortcut: '', action: nav(`${p}/mcp`) },
        { id: 'proj-snapshots', label: 'Open Snapshots', category: 'Project Actions', shortcut: '', action: nav(`${p}/snapshots`) },
      )
    }

    // Quick Actions
    items.push(
      { id: 'quick-new-project', label: 'New Project', category: 'Quick Actions', shortcut: '', action: nav('/projects?new=1') },
    )
    if (resolvedProjectId) {
      items.push(
        { id: 'quick-new-chat', label: 'New Chat Session', category: 'Quick Actions', shortcut: '', action: nav(`/projects/${resolvedProjectId}/chat?new=1`) },
        { id: 'quick-snapshot', label: 'Create Snapshot', category: 'Quick Actions', shortcut: '', action: nav(`/projects/${resolvedProjectId}/snapshots?new=1`) },
      )
    }
    items.push(
      { id: 'quick-mcp-registry', label: 'Browse MCP Registry', category: 'Quick Actions', shortcut: '', action: nav('/settings?tab=mcp') },
      { id: 'quick-skills-market', label: 'Browse Skills Marketplace', category: 'Quick Actions', shortcut: '', action: nav('/skills?tab=marketplace') },
      { id: 'quick-agent-templates', label: 'Browse Agent Templates', category: 'Quick Actions', shortcut: '', action: nav('/agents?tab=templates') },
    )

    // Model Switch
    items.push(
      { id: 'model-opus', label: 'Switch to Opus', category: 'Model Switch', shortcut: '', action: close },
      { id: 'model-sonnet', label: 'Switch to Sonnet', category: 'Model Switch', shortcut: '', action: close },
      { id: 'model-haiku', label: 'Switch to Haiku', category: 'Model Switch', shortcut: '', action: close },
    )

    return items
  }, [resolvedProjectId, router])

  // Filter by fuzzy match
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    return allItems.filter((item) => fuzzyMatch(query, item.label))
  }, [query, allItems])

  // Group by category in defined order
  const grouped = useMemo(() => {
    const map: Record<string, CommandItem[]> = {}
    for (const item of filtered) {
      ;(map[item.category] ??= []).push(item)
    }
    return map
  }, [filtered])

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    return CATEGORY_ORDER.flatMap((cat) => grouped[cat] ?? [])
  }, [grouped])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Global Ctrl/Cmd+K listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => {
          if (!prev) {
            setQuery('')
            setSelectedIndex(0)
          }
          return !prev
        })
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (open) {
      // Small delay to ensure the modal is rendered before focusing
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Keyboard navigation inside the palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i < flatList.length - 1 ? i + 1 : 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i > 0 ? i - 1 : flatList.length - 1))
          break
        case 'Enter':
          e.preventDefault()
          flatList[selectedIndex]?.action()
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          break
      }
    },
    [flatList, selectedIndex]
  )

  if (!open) return null

  let flatIndex = 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]/95 shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-[var(--border)] bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {flatList.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              No results found
            </div>
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat]
              if (!items) return null

              const iconPath = CATEGORY_ICONS[cat]

              return (
                <div key={cat} className="mb-1">
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {iconPath && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                      </svg>
                    )}
                    {cat}
                  </div>

                  {/* Items */}
                  {items.map((item) => {
                    const idx = flatIndex++
                    const isSelected = idx === selectedIndex

                    return (
                      <button
                        key={item.id}
                        ref={(el) => { itemRefs.current[idx] = el }}
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          isSelected
                            ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                            : 'text-[var(--foreground)] hover:bg-[var(--accent)]'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.shortcut && (
                          <kbd className="shrink-0 rounded border border-[var(--border)] bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--border)] bg-[var(--accent)] px-1 py-0.5 font-medium">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--border)] bg-[var(--accent)] px-1 py-0.5 font-medium">
              ↵
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--border)] bg-[var(--accent)] px-1 py-0.5 font-medium">
              esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}
