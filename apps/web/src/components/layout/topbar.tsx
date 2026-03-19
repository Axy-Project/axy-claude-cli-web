'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import { useRouter, usePathname } from 'next/navigation'

interface TopbarProps {
  onMenuToggle?: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuthStore()
  const currentProject = useProjectStore((s) => s.currentProject)
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  // Show project name if we're inside a project
  const isInProject = pathname.includes('/projects/') && pathname.split('/projects/')[1]?.length > 0
  const projectName = isInProject ? currentProject?.name : null

  return (
    <header className="flex h-16 shrink-0 items-center justify-between bg-[var(--background)]/60 px-6 backdrop-blur-xl">
      {/* Left: hamburger on mobile */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] md:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {/* Mobile logo */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dim)]">
            <span className="font-headline text-xs font-bold text-white">A</span>
          </div>
          <span className="font-headline text-sm font-semibold">Claude CLI</span>
        </div>

        {/* Project name or session info */}
        <div className="hidden items-center gap-2 md:flex">
          {projectName ? (
            <span className="font-label text-xs text-[#adaaaa]">
              Session: <span className="text-white">{projectName}</span>
            </span>
          ) : (
            <span className="font-label text-xs text-[#adaaaa]">Axy Web</span>
          )}
        </div>
      </div>

      {/* Right: user */}
      <div className="flex items-center gap-3">
        {user && (
          <>
            <div className="hidden items-center gap-2.5 sm:flex">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-7 w-7 rounded-full ring-1 ring-[var(--outline-variant)]"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-highest)]">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <span className="text-sm font-medium text-[var(--foreground)]">{user.displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-highest)] hover:text-[var(--foreground)]"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  )
}
