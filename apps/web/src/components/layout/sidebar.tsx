'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm-11 11h7v7H3v-7zm11 0h7v7h-7v-7z' },
  { href: '/projects', label: 'Projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { href: '/agents', label: 'Agents', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/skills', label: 'Skills', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
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
              {/* GitHub Star button */}
              <a href="https://github.com/Axy-Project/axy-claude-cli-web" target="_blank" rel="noopener noreferrer" className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-[0.375rem] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-mid)]" style={{ border: '1px solid rgba(72,72,71,0.2)' }}>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                <svg className="h-3.5 w-3.5 text-[#ffb74d]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                Star on GitHub
              </a>
              <a href="https://github.com/Axy-Project/axy-claude-cli-web" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[0.375rem] px-4 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:text-white">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Documentation
              </a>
              <a href="https://github.com/Axy-Project/axy-claude-cli-web/issues" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[0.375rem] px-4 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:text-white">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                Feedback
              </a>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
