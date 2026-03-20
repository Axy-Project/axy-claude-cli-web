'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/projects', label: 'Projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { href: '/agents', label: 'Agents', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/skills', label: 'Skills', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { href: '/org', label: 'Organization', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const bottomItems = [
  { href: 'https://github.com/Axy-Project/AxyWeb', label: 'Documentation', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', external: true },
  { href: 'https://github.com/Axy-Project/AxyWeb/issues', label: 'Feedback', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', external: true },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

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

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--surface-low)] transition-transform duration-200 ease-in-out md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Axy" className="h-8 w-8 rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <span className="font-headline text-base font-bold tracking-tight text-white">Axy</span>
              <p className="text-[9px] leading-tight text-[#767575]">Claude CLI from your browser</p>
            </div>
          </Link>
          {/* Close button - mobile */}
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] md:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
          {/* Search */}
          <Link
            href="/search"
            onClick={onClose}
            className={cn(
              'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200',
              pathname.startsWith('/search')
                ? 'bg-gradient-to-r from-[var(--primary)]/10 to-transparent border-r-2 border-[var(--primary)] text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-mid)] hover:text-[var(--foreground)]'
            )}
          >
            <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
            <kbd className="ml-auto rounded bg-[var(--surface-highest)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--muted-foreground)]">
              Ctrl+/
            </kbd>
          </Link>

          <div className="my-3" />

          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-[var(--primary)]/10 to-transparent border-r-2 border-[var(--primary)] text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-mid)] hover:text-[var(--foreground)]'
                )}
              >
                <svg
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors',
                    isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]'
                  )}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom links */}
        <div className="space-y-0.5 px-3 pb-4 pt-2">
          {bottomItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </a>
          ))}
        </div>
      </aside>
    </>
  )
}
