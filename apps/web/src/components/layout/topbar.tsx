'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const isInProject = pathname.includes('/projects/') && pathname.split('/projects/')[1]?.length > 0
  const projectName = isInProject ? currentProject?.name : null

  useEffect(() => {
    if (!profileOpen) return
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-6" style={{ background: 'rgba(14,14,14,0.6)', backdropFilter: 'blur(20px)' }}>
      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="rounded-md p-1.5 text-[#767575] hover:text-white md:hidden">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="hidden md:block">
          {projectName ? (
            <span className="text-xs text-[#767575]">Session: <span className="text-[#adaaaa]">{projectName}</span></span>
          ) : (
            <span className="text-xs text-[#767575]">Axy Web</span>
          )}
        </div>
      </div>

      {/* Right: notification + help + avatar */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="rounded-full p-2 text-[#767575] transition-colors hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </button>
        {/* Help */}
        <button className="rounded-full p-2 text-[#767575] transition-colors hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </button>
        {/* Avatar with dropdown */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => setProfileOpen(!profileOpen)} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[0.375rem] transition-all hover:ring-2 hover:ring-[#bd9dff]/30" style={{ border: '1px solid rgba(72,72,71,0.3)' }}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-[#adaaaa]">{user?.displayName?.charAt(0)?.toUpperCase() || '?'}</span>
            )}
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[0.75rem] py-2 shadow-[0_40px_60px_-10px_rgba(255,255,255,0.04)]" style={{ background: '#262626', border: '1px solid rgba(72,72,71,0.2)' }}>
                <div className="px-4 py-2">
                  <p className="text-sm font-semibold text-white">{user?.displayName}</p>
                  <p className="text-[11px] text-[#767575]">{user?.email}</p>
                </div>
                <div className="my-1" style={{ borderTop: '1px solid rgba(72,72,71,0.15)' }} />
                <button onClick={() => { setProfileOpen(false); router.push('/settings') }} className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-[#adaaaa] transition-colors hover:bg-[#1a1a1a] hover:text-white">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Settings
                </button>
                <div className="my-1" style={{ borderTop: '1px solid rgba(72,72,71,0.15)' }} />
                <button onClick={() => { logout(); router.replace('/login') }} className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-[#ff6e84] transition-colors hover:bg-[#1a1a1a]">
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
