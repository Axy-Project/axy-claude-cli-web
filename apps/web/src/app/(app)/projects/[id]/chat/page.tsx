'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { Session } from '@axy/shared'
import { formatDate, formatTokens } from '@/lib/utils'
import { Pin, PinOff, CheckSquare, Square, Trash2, X } from 'lucide-react'

export default function ChatListPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const loadSessions = useCallback(() => {
    setIsLoading(true)
    api
      .get<Session[]>(`/api/sessions/project/${projectId}`)
      .then(setSessions)
      .finally(() => setIsLoading(false))
  }, [projectId])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const createSession = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const session = await api.post<Session>('/api/sessions', { projectId })
      router.push(`/projects/${projectId}/chat/${session.id}`)
    } catch (err) {
      console.error('Failed to create session:', err)
      setIsCreating(false)
    }
  }

  const renameSession = async (sessionId: string) => {
    const title = editTitle.trim()
    if (!title) {
      setEditingId(null)
      return
    }
    try {
      await api.patch(`/api/sessions/${sessionId}`, { title })
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
      )
    } catch (err) {
      console.error('Failed to rename session:', err)
    }
    setEditingId(null)
  }

  const deleteSession = async (sessionId: string) => {
    try {
      await api.delete(`/api/sessions/${sessionId}`)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const togglePin = async (sessionId: string, currentPinned: boolean) => {
    try {
      await api.patch(`/api/sessions/${sessionId}`, { isPinned: !currentPinned })
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, isPinned: !currentPinned } as Session & { isPinned: boolean } : s
        )
      )
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sessions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sessions.map((s) => s.id)))
    }
  }

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} session${selectedIds.size !== 1 ? 's' : ''} and all their messages?`)) return
    setIsBulkDeleting(true)
    try {
      await api.post('/api/sessions/bulk-delete', { ids: Array.from(selectedIds) })
      setSessions((prev) => prev.filter((s) => !selectedIds.has(s.id)))
      setSelectedIds(new Set())
      setSelectMode(false)
    } catch (err) {
      console.error('Failed to bulk delete sessions:', err)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Sort sessions: pinned first → active → rest (by updatedAt DESC)
  const sortedSessions = [...sessions].sort((a, b) => {
    const aPinned = (a as Session & { isPinned?: boolean }).isPinned ? 1 : 0
    const bPinned = (b as Session & { isPinned?: boolean }).isPinned ? 1 : 0
    if (aPinned !== bPinned) return bPinned - aPinned
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Chat Sessions</h2>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => {
                setSelectMode((prev) => !prev)
                setSelectedIds(new Set())
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                selectMode
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
              }`}
            >
              {selectMode ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
          <button
            onClick={createSession}
            disabled={isCreating}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isCreating ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )}
            New Session
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectMode && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              {selectedIds.size === sessions.length ? (
                <CheckSquare className="h-4 w-4 text-[var(--primary)]" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectedIds.size === sessions.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-[var(--muted-foreground)]">
              {selectedIds.size} selected
            </span>
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={bulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isBulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="h-4 w-48 rounded bg-[var(--secondary)]" />
              <div className="mt-2 h-3 w-32 rounded bg-[var(--secondary)]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessions.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
            <svg className="h-8 w-8 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-[var(--foreground)]">
            No chat sessions yet
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Start a new session to chat with Claude about your project.
          </p>
          <button
            onClick={createSession}
            disabled={isCreating}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Start your first conversation
          </button>
        </div>
      )}

      {/* Sessions list */}
      {!isLoading && sortedSessions.length > 0 && (
        <div className="space-y-2">
          {sortedSessions.map((session) => {
            const isPinned = (session as Session & { isPinned?: boolean }).isPinned ?? false
            return (
              <div
                key={session.id}
                className={`group relative rounded-lg border bg-[var(--card)] p-4 transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]/30 ${
                  isPinned ? 'border-[var(--primary)]/30' : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Checkbox for select mode */}
                  {selectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(session.id)
                      }}
                      className="mt-0.5 shrink-0"
                    >
                      {selectedIds.has(session.id) ? (
                        <CheckSquare className="h-4 w-4 text-[var(--primary)]" />
                      ) : (
                        <Square className="h-4 w-4 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (selectMode) {
                        toggleSelect(session.id)
                      } else {
                        router.push(`/projects/${projectId}/chat/${session.id}`)
                      }
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {/* Pin indicator */}
                      {isPinned && !selectMode && (
                        <Pin className="h-3 w-3 shrink-0 text-[var(--primary)]" />
                      )}
                      {/* Status indicator */}
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          session.isActive
                            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]'
                            : 'bg-[var(--muted-foreground)]/30'
                        }`}
                      />
                      {editingId === session.id ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => renameSession(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameSession(session.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded border border-[var(--primary)]/50 bg-[var(--background)] px-2 py-0.5 text-sm font-medium text-[var(--foreground)] outline-none"
                        />
                      ) : (
                        <h3 className="truncate text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">
                          {session.title || 'Untitled session'}
                        </h3>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                      <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[10px]">
                        {session.model}
                      </span>
                      <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[10px]">
                        {session.mode}
                      </span>
                      {(session.totalInputTokens > 0 || session.totalOutputTokens > 0) && (
                        <span className="flex items-center gap-1">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          {formatTokens(session.totalInputTokens + session.totalOutputTokens)} tokens
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Date + Actions */}
                  {!selectMode && (
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[10px] text-[var(--muted-foreground)] group-hover:hidden">
                        {formatDate(session.updatedAt)}
                      </span>
                      {/* Pin button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePin(session.id, isPinned)
                        }}
                        className="hidden rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--primary)] group-hover:inline-flex"
                        title={isPinned ? 'Unpin' : 'Pin'}
                      >
                        {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                      {/* Rename button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(session.id)
                          setEditTitle(session.title || '')
                        }}
                        className="hidden rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] group-hover:inline-flex"
                        title="Rename"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this session and all its messages?')) {
                            deleteSession(session.id)
                          }
                        }}
                        className="hidden rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-400 group-hover:inline-flex"
                        title="Delete"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
