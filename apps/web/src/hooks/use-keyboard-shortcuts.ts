import { useEffect } from 'react'

export interface Shortcut {
  key: string // e.g. 'n', 'k', 't', 'g', '/'
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
  when?: () => boolean // condition for shortcut to be active
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in form fields
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const ctrlOrMeta = e.ctrlKey || e.metaKey
        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          (shortcut.ctrl ? ctrlOrMeta : !ctrlOrMeta) &&
          (shortcut.shift ? e.shiftKey : !e.shiftKey) &&
          (shortcut.alt ? e.altKey : !e.altKey) &&
          (!shortcut.when || shortcut.when())
        ) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}

export const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Ctrl+K', description: 'Command palette' },
  { keys: 'Ctrl+/', description: 'Search' },
  { keys: 'Ctrl+N', description: 'New chat session' },
  { keys: 'Ctrl+T', description: 'Toggle terminal' },
  { keys: 'Ctrl+B', description: 'Toggle sidebar' },
  { keys: 'Ctrl+G', description: 'Open git panel' },
  { keys: 'Ctrl+E', description: 'Open file explorer' },
  { keys: 'Ctrl+S', description: 'Save current file' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Escape', description: 'Close modal/overlay' },
]
