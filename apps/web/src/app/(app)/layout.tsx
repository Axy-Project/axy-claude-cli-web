'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { api } from '@/lib/api-client'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { useKeyboardShortcuts, type Shortcut } from '@/hooks/use-keyboard-shortcuts'
import { wsClient, type WsConnectionState } from '@/lib/ws-client'

interface UpdateInfo {
  current: string
  latest: string
  updateAvailable: boolean
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading, isPendingApproval, user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<{ status: string; message: string } | null>(null)
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
    if (!isLoading && !isAuthenticated && !isPendingApproval) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, isPendingApproval, router])

  // Show pending approval screen
  if (isPendingApproval) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ background: '#0e0e0e' }}>
        <div className="w-full max-w-md rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
            <svg className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Pending Approval</h2>
          <p className="mt-2 text-sm text-[#adaaaa]">
            Your account {user?.displayName ? `(${user.displayName})` : ''} is waiting for admin approval. You&apos;ll get access once an administrator approves your request.
          </p>
          <button
            onClick={() => { logout(); router.replace('/login') }}
            className="mt-6 rounded-lg border border-[#484847]/30 px-4 py-2 text-sm text-[#adaaaa] transition-colors hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

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

  // Check for updates every 10 minutes — compare local version against GitHub directly
  useEffect(() => {
    if (!isAuthenticated) return
    const checkUpdate = async () => {
      try {
        // Get current version from our API
        const apiUrl = typeof window !== 'undefined'
          ? (window.location.port === '' || window.location.port === '80' || window.location.port === '443')
            ? `${window.location.protocol}//${window.location.hostname}`
            : `${window.location.protocol}//${window.location.hostname}:3456`
          : ''
        const healthRes = await fetch(`${apiUrl}/api/health`)
        if (!healthRes.ok) return
        const health = await healthRes.json()
        const current = health.version

        // Get latest version directly from GitHub (no backend cache)
        const ghRes = await fetch('https://raw.githubusercontent.com/Axy-Project/axy-claude-cli-web/main/VERSION')
        if (!ghRes.ok) return
        const latest = (await ghRes.text()).trim()

        if (latest !== current) {
          setUpdateInfo({ current, latest, updateAvailable: true })
        }
      } catch { /* ignore */ }
    }
    checkUpdate()
    const interval = setInterval(checkUpdate, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Poll update progress (persists across page reloads)
  useEffect(() => {
    if (!isAuthenticated) return
    const checkUpdateProgress = async () => {
      try {
        const res = await api.get<{ status: string; message: string; completedAt?: string }>('/api/health/update-status')
        if (res.status !== 'idle') {
          setUpdateProgress(res)
          if (res.status === 'done') {
            setTimeout(() => setUpdateProgress(null), 5000)
          }
        } else {
          setUpdateProgress(null)
        }
      } catch { /* server might be restarting */ }
    }
    checkUpdateProgress()
    const interval = setInterval(checkUpdateProgress, 3000)
    return () => clearInterval(interval)
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
        {updateProgress && updateProgress.status !== 'idle' && (
          <div className="bg-[var(--primary)] px-4 py-2">
            <div className="flex items-center justify-between text-xs font-medium text-white">
              <div className="flex items-center gap-2">
                {updateProgress.status !== 'done' && updateProgress.status !== 'error' && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {updateProgress.status === 'done' && <span className="text-green-200">Done!</span>}
                <span>{updateProgress.message}</span>
              </div>
            </div>
            {updateProgress.status !== 'done' && updateProgress.status !== 'error' && (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full animate-pulse rounded-full bg-white/60" style={{ width: '60%' }} />
              </div>
            )}
          </div>
        )}
        {wsState.isReconnecting && !updateProgress && (
          <div className="flex items-center justify-center gap-2 bg-[var(--primary-dim)] px-3 py-1.5 text-xs font-medium text-white">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
            Reconnecting... (attempt {wsState.reconnectAttempt})
          </div>
        )}
        {/* Update available banner */}
        {updateInfo?.updateAvailable && !updateDismissed && (
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2" style={{ background: 'rgba(189,157,255,0.08)', borderBottom: '1px solid rgba(189,157,255,0.15)' }}>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span className="text-xs text-[var(--foreground)]">
                Update available: <span className="font-mono font-semibold text-[var(--primary)]">v{updateInfo.latest}</span>
                <span className="text-[var(--muted-foreground)]"> (current: v{updateInfo.current})</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!confirm(`Update from v${updateInfo.current} to v${updateInfo.latest}?\n\nThe server will restart. This may take up to a minute.`)) return
                  setIsUpdating(true)
                  try {
                    const apiUrl = typeof window !== 'undefined'
                      ? (window.location.port === '' || window.location.port === '80' || window.location.port === '443')
                        ? `${window.location.protocol}//${window.location.hostname}`
                        : `${window.location.protocol}//${window.location.hostname}:3456`
                      : ''
                    const res = await fetch(`${apiUrl}/api/health/update`, { method: 'POST' })
                    const data = await res.json()
                    if (!data.success) {
                      alert(data.error || 'Update failed')
                      setIsUpdating(false)
                      return
                    }
                    // Poll until server comes back with new version
                    const pollUpdate = setInterval(async () => {
                      try {
                        const r = await fetch(`${apiUrl}/api/health`)
                        if (r.ok) {
                          const h = await r.json()
                          if (h.version !== updateInfo.current) {
                            clearInterval(pollUpdate)
                            setIsUpdating(false)
                            setUpdateDismissed(true)
                            window.location.reload()
                          }
                        }
                      } catch { /* server restarting */ }
                    }, 5000)
                    setTimeout(() => { clearInterval(pollUpdate); setIsUpdating(false) }, 180000)
                  } catch { setIsUpdating(false) }
                }}
                disabled={isUpdating}
                className="rounded-[0.375rem] px-3 py-1 text-[11px] font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dim))' }}
              >
                {isUpdating ? 'Updating...' : 'Update Now'}
              </button>
              <a
                href="https://github.com/Axy-Project/axy-claude-cli-web/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[0.375rem] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                Release Notes
              </a>
              <button
                onClick={() => setUpdateDismissed(true)}
                className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
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
