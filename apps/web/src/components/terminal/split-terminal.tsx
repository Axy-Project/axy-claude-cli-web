'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { useTerminalStore } from '@/stores/terminal.store'
import { Terminal, X, GripVertical, Maximize2, Minimize2 } from 'lucide-react'

interface SplitTerminalProps {
  projectId: string
  children: React.ReactNode
}

export function SplitTerminal({ projectId, children }: SplitTerminalProps) {
  const { panelOpen, panelWidth, togglePanel, setPanelWidth } = useTerminalStore()
  const isOpen = panelOpen[projectId] ?? false
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMaximized, setIsMaximized] = useState(false)

  // Once terminal is opened, keep it mounted (hidden) to preserve session
  const [wasEverOpened, setWasEverOpened] = useState(false)
  const [TerminalComponent, setTerminalComponent] = useState<React.ComponentType<{ projectId: string }> | null>(null)

  useEffect(() => {
    if (isOpen && !wasEverOpened) {
      setWasEverOpened(true)
    }
  }, [isOpen, wasEverOpened])

  useEffect(() => {
    if (wasEverOpened && !TerminalComponent) {
      import('./embedded-terminal').then((mod) => setTerminalComponent(() => mod.EmbeddedTerminal))
    }
  }, [wasEverOpened, TerminalComponent])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true

      const startX = e.clientX
      const startWidth = panelWidth

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return
        const containerRect = containerRef.current.getBoundingClientRect()
        const totalWidth = containerRect.width
        const delta = startX - ev.clientX
        const deltaPercent = (delta / totalWidth) * 100
        setPanelWidth(startWidth + deltaPercent)
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
    [panelWidth, setPanelWidth]
  )

  return (
    <div ref={containerRef} className="flex h-full">
      {/* Chat panel */}
      <div
        className="min-w-0 overflow-hidden"
        style={{
          width: !isOpen ? '100%' : isMaximized ? '0%' : `${100 - panelWidth}%`,
          display: isMaximized ? 'none' : undefined,
        }}
      >
        <div className="relative h-full">
          {children}
          {/* Floating terminal toggle button — only when panel is closed */}
          {!isOpen && (
            <button
              onClick={() => togglePanel(projectId)}
              className="absolute bottom-20 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-lg transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              title="Open Terminal (split view)"
            >
              <Terminal className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Drag handle — only when panel is open and not maximized */}
      {isOpen && !isMaximized && (
        <div
          onMouseDown={handleMouseDown}
          className="group flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-[var(--border)] transition-colors hover:bg-[var(--primary)]/50"
        >
          <GripVertical className="h-4 w-4 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      )}

      {/* Terminal panel — stays mounted once opened, hidden via CSS when closed */}
      {wasEverOpened && (
        <div
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--border)]"
          style={{
            width: !isOpen ? '0px' : isMaximized ? '100%' : `${panelWidth}%`,
            display: !isOpen ? 'none' : undefined,
          }}
        >
          {/* Terminal panel header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-3 py-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
              <Terminal className="h-3.5 w-3.5" />
              Terminal
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </button>
              <button
                onClick={() => { togglePanel(projectId); setIsMaximized(false) }}
                className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Close terminal panel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Terminal content */}
          <div className="min-h-0 flex-1">
            {TerminalComponent && <TerminalComponent projectId={projectId} />}
          </div>
        </div>
      )}
    </div>
  )
}
