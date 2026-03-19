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
} from 'lucide-react'

const primaryTabs = [
  { href: '', label: 'Overview', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/files', label: 'Files', icon: Code2 },
  { href: '/terminal', label: 'Terminal', icon: Terminal },
  { href: '/git', label: 'Git', icon: GitBranch },
  { href: '/deploy', label: 'Deploy', icon: Rocket },
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
  { href: '/ports', label: 'Preview', icon: Globe },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const { currentProject, fetchProject } = useProjectStore()
  const projectId = params.id as string
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProject(projectId)
  }, [projectId, fetchProject])

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

  function isActive(href: string) {
    if (href === '') {
      return pathname === `/projects/${projectId}`
    }
    return pathname.startsWith(`/projects/${projectId}${href}`)
  }

  const isMoreItemActive = moreTabs.some((item) => isActive(item.href))

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10">
            <span className="text-base font-bold text-[var(--primary)]">
              {currentProject?.name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold md:text-xl">{currentProject?.name || 'Loading...'}</h1>
            {currentProject?.description && (
              <p className="truncate text-xs text-[var(--muted-foreground)]">{currentProject.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Project tabs */}
      <div className="relative mt-3 shrink-0 border-b border-[var(--border)] md:mt-4">
        <nav className="-mx-3 flex items-center gap-0 overflow-x-auto px-3 md:-mx-0 md:gap-0 md:px-0 scrollbar-none scroll-fade-right">
          {primaryTabs.map((item) => {
            const href = `/projects/${projectId}${item.href}`
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors md:px-4 md:py-3 md:text-[13px]',
                  active
                    ? 'text-[var(--primary)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--primary)]" />
                )}
              </Link>
            )
          })}

          {/* More button */}
          <div className="ml-auto shrink-0">
            <button
              onClick={() => setMoreOpen((prev) => !prev)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors md:px-4 md:py-3 md:text-[13px]',
                isMoreItemActive
                  ? 'text-[var(--primary)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">More</span>
              {isMoreItemActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--primary)]" />
              )}
            </button>
          </div>
        </nav>

        {/* More dropdown */}
        {moreOpen && (
          <div ref={moreRef} className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card)] py-1.5 shadow-xl">
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
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
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
      <div className="mt-4 min-h-0 flex-1 md:mt-5">{children}</div>
    </div>
  )
}
