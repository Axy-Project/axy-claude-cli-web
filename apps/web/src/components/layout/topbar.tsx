'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'next/navigation'

interface TopbarProps {
  onMenuToggle?: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuthStore()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 md:px-6">
      {/* Left section: hamburger + logo on mobile, spacer on desktop */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] md:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {/* Logo visible on mobile only (sidebar hidden) */}
        <div className="flex items-center gap-1.5 md:hidden">
          <img src="/logo.svg" alt="Axy" className="h-6 w-auto" />
          <span className="rounded bg-[var(--primary)] px-1 py-0.5 text-[9px] font-medium text-white">WEB</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-7 w-7 rounded-full"
              />
            )}
            <span className="hidden text-sm font-medium sm:inline">{user.displayName}</span>
            <button
              onClick={handleLogout}
              className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  )
}
