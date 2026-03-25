'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProjectStore } from '@/stores/project.store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  MessageSquare,
  Code2,
  Terminal,
  GitBranch,
  Rocket,
  MoreHorizontal,
  Bot,
  Zap,
  Server,
  FileText,
  StickyNote,
  ListTodo,
  Camera,
  Globe,
  Settings,
  Link2,
  ChevronDown,
} from 'lucide-react'

const primaryTabs = [
  { href: '', label: 'Overview', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/files', label: 'Files', icon: Code2 },
  { href: '/terminal', label: 'Terminal', icon: Terminal },
  { href: '/git', label: 'Git', icon: GitBranch },
  { href: '/deploy', label: 'Deploy', icon: Rocket },
  { href: '/ports', label: 'Preview', icon: Globe },
]

const moreTabs = [
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/skills', label: 'Skills', icon: Zap },
  { href: '/mcp', label: 'MCP Servers', icon: Server },
  { href: '/context', label: 'CLAUDE.md', icon: FileText },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/snapshots', label: 'Snapshots', icon: Camera },
  { href: '/cross-ref', label: 'Cross-Ref', icon: Link2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const allTabs = [...primaryTabs, ...moreTabs]

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const { currentProject, fetchProject } = useProjectStore()
  const projectId = params.id as string
  const [moreOpen, setMoreOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const mobileNavRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProject(projectId)
  }, [projectId, fetchProject])

  // Close desktop "More" dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (moreRef.current && !moreRef.current.contains(target)) {
        setMoreOpen(false)
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [moreOpen])

  // Close mobile nav on outside click
  useEffect(() => {
    if (!mobileNavOpen) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (mobileNavRef.current && !mobileNavRef.current.contains(target)) {
        setMobileNavOpen(false)
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [mobileNavOpen])

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  function isActive(href: string) {
    if (href === '') {
      return pathname === `/projects/${projectId}`
    }
    return pathname.startsWith(`/projects/${projectId}${href}`)
  }

  const isMoreItemActive = moreTabs.some((item) => isActive(item.href))

  // Find the currently active tab for the mobile selector
  const activeTab = allTabs.find((item) => isActive(item.href)) || primaryTabs[0]
  const ActiveIcon = activeTab.icon

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          {currentProject?.avatarUrl ? (
            <img
              src={currentProject.avatarUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-[0.375rem] object-cover ring-1 ring-[rgba(72,72,71,0.2)]"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-[0.375rem]" style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}>
              <span className="font-headline text-sm font-bold text-white">
                {currentProject?.name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-headline text-lg font-bold tracking-tight text-white md:text-xl">{currentProject?.name || 'Loading...'}</h1>
            {currentProject?.description && (
              <p className="truncate text-xs text-[#adaaaa]">{currentProject.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: vertical dropdown nav ── */}
      <div className="relative mt-3 shrink-0 md:hidden" ref={mobileNavRef}>
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="flex w-full items-center gap-2.5 rounded-[0.5rem] px-3.5 py-2.5 text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--surface-mid)', border: '1px solid rgba(72,72,71,0.2)' }}
        >
          <ActiveIcon className="h-4 w-4 text-[#bd9dff]" />
          <span className="flex-1 text-left">{activeTab.label}</span>
          <ChevronDown className={cn('h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200', mobileNavOpen && 'rotate-180')} />
        </button>

        {mobileNavOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMobileNavOpen(false)} />
            <div
              className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[70vh] overflow-y-auto rounded-[0.75rem] py-1.5 shadow-[0_40px_60px_-10px_rgba(255,255,255,0.04)]"
              style={{ background: '#262626', border: '1px solid rgba(72,72,71,0.2)' }}
            >
              {/* Primary tabs */}
              <div className="px-3 pb-1 pt-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Main</span>
              </div>
              {primaryTabs.map((item) => {
                const href = `/projects/${projectId}${item.href}`
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-[#bd9dff]/10 text-[#bd9dff]'
                        : 'text-[#adaaaa] hover:bg-[#1a1a1a] hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#bd9dff]" />}
                  </Link>
                )
              })}

              {/* Separator */}
              <div className="mx-3 my-1.5" style={{ borderTop: '1px solid rgba(72,72,71,0.15)' }} />

              {/* Secondary tabs */}
              <div className="px-3 pb-1 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">More</span>
              </div>
              {moreTabs.map((item) => {
                const href = `/projects/${projectId}${item.href}`
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-[#bd9dff]/10 text-[#bd9dff]'
                        : 'text-[#adaaaa] hover:bg-[#1a1a1a] hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#bd9dff]" />}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Desktop: horizontal tabs (unchanged) ── */}
      <div className="relative mt-4 hidden shrink-0 md:block" style={{ borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
        <nav className="flex items-center gap-0">
          {primaryTabs.map((item) => {
            const href = `/projects/${projectId}${item.href}`
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-[13px] font-medium transition-colors',
                  active
                    ? 'text-[#bd9dff]'
                    : 'text-[#adaaaa] hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#bd9dff]" />
                )}
              </Link>
            )
          })}

          {/* More button */}
          <div className="ml-auto shrink-0">
            <button
              onClick={() => setMoreOpen((prev) => !prev)}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium transition-colors',
                isMoreItemActive
                  ? 'text-[#bd9dff]'
                  : 'text-[#adaaaa] hover:text-white'
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
              {isMoreItemActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#bd9dff]" />
              )}
            </button>
          </div>
        </nav>

        {/* More dropdown */}
        {moreOpen && (
          <div ref={moreRef} className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-[0.75rem] py-1.5 shadow-[0_40px_60px_-10px_rgba(255,255,255,0.04)]" style={{ background: '#262626', border: '1px solid rgba(72,72,71,0.2)' }}>
            {moreTabs.map((item) => {
              const href = `/projects/${projectId}${item.href}`
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors',
                    active
                      ? 'bg-[#bd9dff]/10 text-[#bd9dff]'
                      : 'text-[#adaaaa] hover:bg-[#1a1a1a] hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-5 min-h-0 flex-1">{children}</div>
    </div>
  )
}
