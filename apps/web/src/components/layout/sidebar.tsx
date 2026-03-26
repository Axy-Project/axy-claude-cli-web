'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm-11 11h7v7H3v-7zm11 0h7v7h-7v-7z' },
  { href: '/projects', label: 'Projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { href: '/agents', label: 'Agents', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/skills', label: 'Skills', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { href: '/plugins', label: 'Plugins', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { href: '/org', label: 'Organization', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setVersion(d.version)).catch(() => {})
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        router.push('/search')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  const [versionPanelOpen, setVersionPanelOpen] = useState(false)
  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-64'

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--surface-low)] transition-all duration-200 ease-in-out md:static md:translate-x-0',
          sidebarWidth,
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className={cn('flex h-16 items-center gap-2.5', collapsed ? 'justify-center px-2' : 'px-5')}>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Axy" className="h-8 w-8 shrink-0 rounded-lg" onError={(e) => {
              const el = e.target as HTMLImageElement
              el.style.display = 'none'
            }} />
            {!collapsed && (
              <div>
                <span className="font-headline text-base font-bold tracking-tight text-white">Axy</span>
                <p className="text-[9px] leading-tight text-[var(--muted-foreground)]">Claude CLI from your browser</p>
              </div>
            )}
          </Link>
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-[var(--muted-foreground)] hover:text-white md:hidden">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Nav */}
        <nav className={cn('custom-scrollbar flex-1 overflow-y-auto', collapsed ? 'space-y-1 px-2 pt-4' : 'space-y-1 px-3 pt-4')}>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-3 rounded-[0.375rem] transition-all duration-200',
                  collapsed ? 'justify-center px-2 py-3' : 'px-4 py-3',
                  isActive
                    ? 'bg-gradient-to-r from-[var(--primary)]/10 to-transparent text-white'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-mid)] hover:text-white'
                )}
                style={isActive ? { borderRight: '3px solid var(--primary)' } : undefined}
                title={collapsed ? item.label : undefined}
              >
                <svg
                  className={cn('shrink-0 transition-colors', collapsed ? 'h-6 w-6' : 'h-5 w-5', isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] group-hover:text-white')}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: collapse toggle + links */}
        <div className={cn('pb-4 pt-2', collapsed ? 'px-2' : 'px-3')}>
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'hidden w-full items-center gap-3 rounded-[0.375rem] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-white md:flex',
              collapsed && 'justify-center px-2'
            )}
          >
            <svg className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>

          {!collapsed && (
            <div className="mt-2 space-y-0.5">
              <a href="https://github.com/Axy-Project/axy-claude-cli-web" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[0.375rem] px-4 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:text-white">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Documentation
              </a>
              <a href="https://github.com/Axy-Project/axy-claude-cli-web/issues" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[0.375rem] px-4 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:text-white">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                Feedback
              </a>
              <a href="https://github.com/Axy-Project/axy-claude-cli-web" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[0.375rem] px-4 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[#ffb74d]">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                Star on GitHub
              </a>
            </div>
          )}
          {/* Version badge — clickable to open version manager */}
          {version && (
            <VersionBadge version={version} collapsed={collapsed} />
          )}
        </div>
      </aside>
    </>
  )
}

// ────────────────────────────────────────────────────────────
// Version Badge + Version Manager Popup
// ────────────────────────────────────────────────────────────
function VersionBadge({ version, collapsed }: { version: string; collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [actionVersion, setActionVersion] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'update' | 'rollback' | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Fetch versions when opened
  const fetchVersions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ current: string; versions: string[] }>('/api/health/versions')
      setVersions(res.versions)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const handleOpen = () => {
    setOpen(!open)
    if (!open) fetchVersions()
  }

  const handleAction = async (targetVersion: string, type: 'update' | 'rollback') => {
    const label = type === 'update' ? 'Update' : 'Rollback'
    if (!confirm(`${label} to v${targetVersion}?\n\nThe server will restart. This may take 1-2 minutes.`)) return

    setActionVersion(targetVersion)
    setActionType(type)
    try {
      const endpoint = type === 'update' ? '/api/health/update' : '/api/health/rollback'
      const body = type === 'rollback' ? { version: targetVersion } : undefined
      const apiUrl = typeof window !== 'undefined'
        ? (window.location.port === '' || window.location.port === '80' || window.location.port === '443')
          ? `${window.location.protocol}//${window.location.hostname}`
          : `${window.location.protocol}//${window.location.hostname}:3456`
        : ''
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || `${label} failed`)
        setActionVersion(null)
        setActionType(null)
        return
      }
      // Poll until server comes back with new version
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`${apiUrl}/api/health`)
          if (r.ok) {
            const h = await r.json()
            if (h.version !== version) {
              clearInterval(poll)
              window.location.reload()
            }
          }
        } catch { /* server restarting */ }
      }, 5000)
      setTimeout(() => { clearInterval(poll); setActionVersion(null); setActionType(null) }, 180000)
    } catch {
      setActionVersion(null)
      setActionType(null)
    }
  }

  const compareVersions = (a: string, b: string) => {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return 1
      if ((pa[i] || 0) < (pb[i] || 0)) return -1
    }
    return 0
  }

  return (
    <div className="relative mt-2">
      <button
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-1 rounded-md transition-colors hover:bg-[var(--surface-mid)]',
          collapsed ? 'mx-auto px-1.5 py-1' : 'px-4 py-1'
        )}
      >
        <span className={cn('font-mono font-medium text-[var(--muted-foreground)]/60 transition-colors hover:text-[var(--primary)]', collapsed ? 'text-[9px]' : 'text-[10px]')}>
          v{version}
        </span>
        {!collapsed && (
          <svg className="h-3 w-3 text-[var(--muted-foreground)]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        )}
      </button>

      {/* Version manager popup */}
      {open && (
        <div
          ref={popupRef}
          className="absolute bottom-full left-0 z-[60] mb-2 w-64 rounded-lg shadow-2xl"
          style={{ background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.25)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
            <span className="text-xs font-semibold text-white">Version Manager</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>
              v{version}
            </span>
          </div>

          {/* Version list */}
          <div className="custom-scrollbar max-h-[240px] overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)', borderTopColor: 'var(--primary)' }} />
              </div>
            ) : versions.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-[var(--muted-foreground)]">No versions found</p>
            ) : (
              versions.map((v) => {
                const cmp = compareVersions(v, version)
                const isCurrent = cmp === 0
                const isNewer = cmp > 0
                const isProcessing = actionVersion === v

                return (
                  <div
                    key={v}
                    className={cn(
                      'flex items-center justify-between px-3 py-1.5 transition-colors',
                      isCurrent ? '' : 'hover:bg-[var(--surface-mid)]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('font-mono text-[12px]', isCurrent ? 'font-bold text-[var(--primary)]' : 'text-[#e0e0e0]')}>
                        v{v}
                      </span>
                      {isCurrent && (
                        <span className="rounded-sm px-1 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>
                          current
                        </span>
                      )}
                      {isNewer && (
                        <span className="rounded-sm bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                          new
                        </span>
                      )}
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => handleAction(v, isNewer ? 'update' : 'rollback')}
                        disabled={!!actionVersion}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-medium transition-all disabled:opacity-40',
                          isNewer
                            ? 'text-emerald-400 hover:bg-emerald-500/15'
                            : 'text-amber-400 hover:bg-amber-500/15'
                        )}
                      >
                        {isProcessing ? (
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                            {actionType === 'update' ? 'Updating...' : 'Rolling back...'}
                          </span>
                        ) : isNewer ? 'Update' : 'Rollback'}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5" style={{ borderTop: '1px solid rgba(72,72,71,0.15)' }}>
            <a
              href="https://github.com/Axy-Project/axy-claude-cli-web/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-white"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Release Notes
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
