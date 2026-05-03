'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { Session } from '@axy/shared'

export function WorkspaceChatList({
  projectId,
  currentSessionId,
}: {
  projectId: string
  currentSessionId: string
}) {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = async () => {
    try {
      const data = await api.get<Session[]>(`/api/sessions?projectId=${projectId}`)
      setSessions(data)
    } catch (e) {
      console.error('Failed to load sessions', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [projectId])

  const handleNewSession = async () => {
    try {
      const newSession = await api.post<Session>('/api/sessions', {
        projectId,
        title: 'New chat',
      })
      router.push(`/projects/${projectId}/workspace/${newSession.id}`)
    } catch (e) {
      console.error('Failed to create session', e)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Chats</span>
        <button
          onClick={handleNewSession}
          className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-white/5 hover:text-[var(--primary)]"
          title="New chat"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-2">
        {loading ? (
          <div className="px-3 py-4 text-[11px] text-[var(--muted-foreground)]">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-[var(--muted-foreground)]">No chat sessions</div>
        ) : (
          sessions.map((s) => {
            const active = s.id === currentSessionId
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/projects/${projectId}/workspace/${s.id}`)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[12px] transition-colors ${
                  active
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'text-[var(--foreground)] hover:bg-white/5'
                }`}
              >
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-[var(--primary)]' : 'bg-[var(--muted-foreground)]/40'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{s.title || 'Untitled'}</div>
                  <div className="truncate text-[10px] text-[var(--muted-foreground)]">
                    {s.model?.replace('claude-', '').replace(/-\d+$/, '') || 'sonnet-4-6'}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
