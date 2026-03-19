'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { useKeyboardShortcuts, type Shortcut } from '@/hooks/use-keyboard-shortcuts'
import { wsClient, type WsConnectionState } from '@/lib/ws-client'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [wsState, setWsState] = useState<WsConnectionState>({
    connected: false,
    isReconnecting: false,
    reconnectAttempt: 0,
  })
  const wsCleanupRef = useRef<(() => void) | null>(null)

  const toggleShortcuts = useCallback(() => setShortcutsOpen((v) => !v), [])
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])

  const shortcuts = useMemo<Shortcut[]>(() => [
    { key: '?', description: 'Show keyboard shortcuts', action: toggleShortcuts },
    { key: 'b', ctrl: true, description: 'Toggle sidebar', action: toggleSidebar },
  ], [toggleShortcuts, toggleSidebar])

  useKeyboardShortcuts(shortcuts)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  // Track WS reconnection state
  useEffect(() => {
    return wsClient.onConnectionState(setWsState)
  }, [])

  // Global WS listeners for chat streaming - persist across page navigation
  useEffect(() => {
    if (isAuthenticated && !wsCleanupRef.current) {
      wsCleanupRef.current = useChatStore.getState().initWsListeners()
    }
    return () => {
      wsCleanupRef.current?.()
      wsCleanupRef.current = null
    }
  }, [isAuthenticated])

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <img src="/logo.svg" alt="Axy" className="h-12 w-auto animate-pulse" />
        <span className="text-sm text-[var(--muted-foreground)]">Loading...</span>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {wsState.isReconnecting && (
          <div className="flex items-center justify-center gap-2 bg-[var(--primary-dim)] px-3 py-1.5 text-xs font-medium text-white">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
            Reconnecting... (attempt {wsState.reconnectAttempt})
          </div>
        )}
        <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="custom-scrollbar flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
      <CommandPalette />
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
