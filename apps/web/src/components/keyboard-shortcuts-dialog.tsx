'use client'

import { useEffect, useRef } from 'react'
import { SHORTCUTS } from '@/hooks/use-keyboard-shortcuts'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

const CATEGORIES: { label: string; keys: string[] }[] = [
  {
    label: 'Navigation',
    keys: ['Ctrl+K', 'Ctrl+/', 'Ctrl+B'],
  },
  {
    label: 'Editor',
    keys: ['Ctrl+E', 'Ctrl+S'],
  },
  {
    label: 'Git',
    keys: ['Ctrl+G'],
  },
  {
    label: 'Chat',
    keys: ['Ctrl+N', 'Ctrl+T'],
  },
  {
    label: 'General',
    keys: ['?', 'Escape'],
  },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-[var(--border)] bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--muted-foreground)]">
      {children}
    </kbd>
  )
}

function ShortcutKeys({ keys }: { keys: string }) {
  const parts = keys.split('+')
  return (
    <span className="flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[var(--muted-foreground)]/50">+</span>}
          <Kbd>{part}</Kbd>
        </span>
      ))}
    </span>
  )
}

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  // Build a lookup from SHORTCUTS constant
  const shortcutMap = new Map(SHORTCUTS.map((s) => [s.keys, s.description]))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]/95 shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          <div className="space-y-5">
            {CATEGORIES.map((category) => (
              <div key={category.label}>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {category.label}
                </h3>
                <div className="space-y-1.5">
                  {category.keys.map((keyCombo) => {
                    const desc = shortcutMap.get(keyCombo)
                    if (!desc) return null
                    return (
                      <div
                        key={keyCombo}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--accent)]"
                      >
                        <span className="text-[var(--foreground)]">{desc}</span>
                        <ShortcutKeys keys={keyCombo} />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] px-5 py-2.5 text-center text-[10px] text-[var(--muted-foreground)]">
          Press <Kbd>?</Kbd> to toggle this dialog
        </div>
      </div>
    </div>
  )
}
