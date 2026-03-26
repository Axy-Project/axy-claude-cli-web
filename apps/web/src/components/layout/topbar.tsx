'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api-client'

interface RecentSession {
  id: string
  projectId: string
  title: string | null
  model: string
  updatedAt: string
  projectName: string
  projectAvatarUrl: string | null
}

interface TopbarProps {
  onMenuToggle?: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuthStore()
  const currentProject = useProjectStore((s) => s.currentProject)
  const router = useRouter()
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const [quickAccessOpen, setQuickAccessOpen] = useState(false)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const quickAccessRef = useRef<HTMLDivElement>(null)

  const isInProject = pathname.includes('/projects/') && pathname.split('/projects/')[1]?.length > 0
  const projectName = isInProject ? currentProject?.name : null

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  // Close quick access on outside click
  useEffect(() => {
    if (!quickAccessOpen) return
    const handler = (e: MouseEvent) => {
      if (quickAccessRef.current && !quickAccessRef.current.contains(e.target as Node)) setQuickAccessOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [quickAccessOpen])

  // Fetch recent sessions when quick access opens
  const fetchRecent = useCallback(async () => {
    setLoadingRecent(true)
    try {
      const data = await api.get<RecentSession[]>('/api/sessions/recent?limit=15')
      setRecentSessions(data)
    } catch {
      // ignore
    } finally {
      setLoadingRecent(false)
    }
  }, [])

  useEffect(() => {
    if (quickAccessOpen) fetchRecent()
  }, [quickAccessOpen, fetchRecent])

  // Group sessions by project
  const groupedByProject = recentSessions.reduce<Record<string, { projectId: string; projectName: string; projectAvatarUrl: string | null; sessions: RecentSession[] }>>((acc, s) => {
    if (!acc[s.projectId]) {
      acc[s.projectId] = { projectId: s.projectId, projectName: s.projectName, projectAvatarUrl: s.projectAvatarUrl, sessions: [] }
    }
    acc[s.projectId].sessions.push(s)
    return acc
  }, {})

  const projectGroups = Object.values(groupedByProject)

  function formatRelativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between px-4 md:px-6" style={{ background: 'rgba(14,14,14,0.6)', backdropFilter: 'blur(20px)' }}>
      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:text-white md:hidden">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="hidden md:block">
          {projectName ? (
            <span className="text-xs text-[var(--muted-foreground)]">Session: <span className="text-[var(--secondary-foreground)]">{projectName}</span></span>
          ) : (
            <span className="text-xs text-[var(--muted-foreground)]">Axy Web</span>
          )}
        </div>
      </div>

      {/* Right: quick access + notification + help + avatar */}
      <div className="flex items-center gap-2">
        {/* Quick Access - Recent Projects & Chats */}
        <div className="relative" ref={quickAccessRef}>
          <button
            onClick={() => setQuickAccessOpen(!quickAccessOpen)}
            className={`rounded-full p-2 transition-colors ${quickAccessOpen ? 'text-[#bd9dff]' : 'text-[var(--muted-foreground)] hover:text-white'}`}
            title="Quick Access"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>

          {quickAccessOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setQuickAccessOpen(false)} />
              <div
                className="fixed inset-x-3 top-16 z-50 max-h-[80vh] rounded-[0.75rem] shadow-[0_40px_60px_-10px_rgba(255,255,255,0.04)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-h-[420px]"
                style={{ background: 'var(--surface-highest)', border: '1px solid rgba(72,72,71,0.2)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--secondary-foreground)]">Quick Access</span>
                  <button
                    onClick={() => { setQuickAccessOpen(false); router.push('/projects') }}
                    className="text-[10px] font-medium text-[#bd9dff] hover:text-[#d4bfff] transition-colors"
                  >
                    All Projects
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[420px] overflow-y-auto custom-scrollbar py-1">
                  {loadingRecent ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)', borderTopColor: 'var(--primary)' }} />
                    </div>
                  ) : projectGroups.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-[var(--muted-foreground)]">No recent chats</p>
                    </div>
                  ) : (
                    projectGroups.map((group) => (
                      <div key={group.projectId}>
                        {/* Project header */}
                        <button
                          onClick={() => { setQuickAccessOpen(false); router.push(`/projects/${group.projectId}`) }}
                          className="flex w-full items-center gap-2.5 px-4 py-2 transition-colors hover:bg-[var(--surface-mid)]"
                        >
                          {group.projectAvatarUrl ? (
                            <img
                              src={group.projectAvatarUrl}
                              alt=""
                              className="h-5 w-5 shrink-0 rounded-[0.25rem] object-cover ring-1 ring-[rgba(72,72,71,0.2)]"
                            />
                          ) : (
                            <div
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.25rem]"
                              style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
                            >
                              <span className="text-[9px] font-bold text-white">{group.projectName?.charAt(0).toUpperCase() || '?'}</span>
                            </div>
                          )}
                          <span className="truncate text-xs font-semibold text-white">{group.projectName}</span>
                          <svg className="ml-auto h-3 w-3 shrink-0 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        {/* Sessions for this project */}
                        {group.sessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => { setQuickAccessOpen(false); router.push(`/projects/${session.projectId}/chat/${session.id}`) }}
                            className="flex w-full items-center gap-2.5 py-1.5 pl-11 pr-4 transition-colors hover:bg-[var(--surface-mid)]"
                          >
                            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                            </svg>
                            <span className="min-w-0 flex-1 truncate text-left text-[11px] text-[var(--secondary-foreground)]">
                              {session.title || 'Untitled chat'}
                            </span>
                            <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">
                              {formatRelativeTime(session.updatedAt)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(72,72,71,0.15)' }}>
                  <button
                    onClick={() => { setQuickAccessOpen(false); router.push('/projects/new') }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[0.375rem] py-1.5 text-xs font-medium text-white transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New Project
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notification bell */}
        <button className="rounded-full p-2 text-[var(--muted-foreground)] transition-colors hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </button>
        {/* Help */}
        <button className="rounded-full p-2 text-[var(--muted-foreground)] transition-colors hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </button>
        {/* Avatar with dropdown */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => setProfileOpen(!profileOpen)} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[0.375rem] transition-all hover:ring-2 hover:ring-[var(--primary)]/30" style={{ border: '1px solid rgba(72,72,71,0.3)' }}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-[var(--secondary-foreground)]">{user?.displayName?.charAt(0)?.toUpperCase() || '?'}</span>
            )}
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[0.75rem] py-2 shadow-[0_40px_60px_-10px_rgba(255,255,255,0.04)]" style={{ background: 'var(--surface-highest)', border: '1px solid rgba(72,72,71,0.2)' }}>
                <div className="px-4 py-2">
                  <p className="text-sm font-semibold text-white">{user?.displayName}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{user?.email}</p>
                </div>
                <div className="my-1" style={{ borderTop: '1px solid rgba(72,72,71,0.15)' }} />
                <button onClick={() => { setProfileOpen(false); router.push('/settings') }} className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-[var(--secondary-foreground)] transition-colors hover:bg-[var(--surface-mid)] hover:text-white">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Settings
                </button>
                <div className="my-1" style={{ borderTop: '1px solid rgba(72,72,71,0.15)' }} />
                <button onClick={() => { logout(); router.replace('/login') }} className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-[var(--error)] transition-colors hover:bg-[var(--surface-mid)]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
