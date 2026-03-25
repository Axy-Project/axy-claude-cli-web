'use client'

import { useState, useEffect, useRef } from 'react'
import { Columns2, Plus } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useMultiChatStore } from '@/stores/multichat.store'
import type { Session } from '@axy/shared'

interface MultiChatPickerProps {
  projectId: string
  currentSessionId: string
}

/**
 * Button + dropdown to open a secondary chat session in split view.
 * Desktop only — hidden on mobile via parent CSS.
 */
export function MultiChatPicker({ projectId, currentSessionId }: MultiChatPickerProps) {
  const { isActive, enable, disable } = useMultiChatStore()
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const handleOpen = async () => {
    if (isActive) {
      disable()
      return
    }
    setOpen(true)
    setLoading(true)
    try {
      const list = await api.get<Session[]>(`/api/sessions/project/${projectId}`)
      setSessions(list.filter((s) => s.id !== currentSessionId))
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (sessionId: string) => {
    setOpen(false)
    enable(sessionId)
  }

  const handleNewSession = async () => {
    setOpen(false)
    try {
      const session = await api.post<Session>('/api/sessions', { projectId })
      enable(session.id)
    } catch (err) {
      console.error('Failed to create session for multichat:', err)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="rounded-[0.375rem] p-1.5 text-[#adaaaa] transition-colors hover:text-white"
        style={{
          background: isActive ? 'rgba(189,157,255,0.1)' : '#1a1a1a',
          border: isActive ? '1px solid rgba(189,157,255,0.3)' : '1px solid rgba(72,72,71,0.2)',
        }}
        title={isActive ? 'Close split view' : 'Open split view (MultiChat)'}
      >
        <Columns2 className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-[0.75rem] py-1.5 shadow-[0_40px_60px_-10px_rgba(255,255,255,0.04)]"
          style={{ background: '#262626', border: '1px solid rgba(72,72,71,0.2)' }}
        >
          <div className="px-3 pb-1.5 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#767575]">
              Open session in split view
            </span>
          </div>

          {loading ? (
            <div className="px-3 py-4 text-center text-xs text-[#767575]">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-[#767575]">No other sessions</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[#adaaaa] transition-colors hover:bg-[#1a1a1a] hover:text-white"
                >
                  <Columns2 className="h-3.5 w-3.5 shrink-0 text-[#767575]" />
                  <span className="min-w-0 flex-1 truncate">{s.title || 'Untitled'}</span>
                  <span className="shrink-0 text-[10px] text-[#767575]">
                    {s.model?.replace('claude-', '').replace(/-\d+$/, '')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* New session option */}
          <div style={{ borderTop: '1px solid rgba(72,72,71,0.15)' }} className="mt-1 pt-1">
            <button
              onClick={handleNewSession}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[#bd9dff] transition-colors hover:bg-[#bd9dff]/10"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>New session</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
