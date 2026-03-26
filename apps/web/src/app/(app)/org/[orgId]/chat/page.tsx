'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useOrgStore } from '@/stores/org.store'
import { api } from '@/lib/api-client'
import { wsClient } from '@/lib/ws-client'
import type { WsServerEvents } from '@axy/shared'

interface TeamMessage {
  id: string
  orgId: string
  senderId: string
  senderName?: string
  senderAvatar?: string
  content: string
  replyToId?: string | null
  linkedSessionId?: string | null
  linkedProjectId?: string | null
  linkedProjectName?: string | null
  createdAt: string
  updatedAt: string
}

export default function TeamChatPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const { user } = useAuthStore()
  const { currentOrg: org, members, fetchOrg, fetchMembers } = useOrgStore()

  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)

  // Fetch org info
  useEffect(() => {
    fetchOrg(orgId)
    fetchMembers(orgId)
  }, [orgId, fetchOrg, fetchMembers])

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.get<TeamMessage[]>(`/api/team-messages/${orgId}`)
      setMessages(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Listen for real-time messages from other users
  useEffect(() => {
    const unsub = wsClient.on('team:message', (data: WsServerEvents['team:message']) => {
      if (data.orgId === orgId && data.senderId !== user?.id) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data as TeamMessage]
        })
      }
    })
    return unsub
  }, [orgId, user?.id])

  // Auto-scroll on new messages
  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }
  }, [messages])

  // Initial scroll to bottom
  const initialScrollDone = useRef(false)
  useEffect(() => {
    if (messages.length > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        })
      })
    }
  }, [messages])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    // Optimistic add
    const optimistic: TeamMessage = {
      id: `temp-${Date.now()}`,
      orgId,
      senderId: user!.id,
      senderName: user!.displayName || undefined,
      senderAvatar: user!.avatarUrl || undefined,
      content: text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    isNearBottomRef.current = true

    try {
      const msg = await api.post<TeamMessage>(`/api/team-messages/${orgId}`, { content: text })
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? msg : m))
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const deleteMessage = async (id: string) => {
    try {
      await api.delete(`/api/team-messages/${id}`)
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } catch {
      // ignore
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (isToday) return time
    if (isYesterday) return `Yesterday ${time}`
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
  }

  // Group consecutive messages by same sender
  const groupedMessages: { message: TeamMessage; showHeader: boolean }[] = messages.map((msg, i) => {
    const prev = i > 0 ? messages[i - 1] : null
    const sameAuthor = prev?.senderId === msg.senderId
    const withinTime = prev ? (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60 * 1000 : false
    return { message: msg, showHeader: !sameAuthor || !withinTime }
  })

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/org/${orgId}`)} className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white">{org?.name || 'Team'} Chat</h1>
            <p className="text-[11px] text-[var(--muted-foreground)]">{members.length} members</p>
          </div>
        </div>
        {/* Online members avatars */}
        <div className="flex -space-x-1.5">
          {members.slice(0, 6).map((m) => (
            <div
              key={m.id}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--background)] text-[9px] font-medium"
              style={{ background: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}
              title={m.user?.displayName || 'Member'}
            >
              {m.user?.displayName?.charAt(0).toUpperCase() || '?'}
            </div>
          ))}
          {members.length > 6 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--background)] bg-[var(--secondary)] text-[9px] text-[var(--muted-foreground)]">
              +{members.length - 6}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)', borderTopColor: 'var(--primary)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}>
              <svg className="h-6 w-6" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--secondary-foreground)]">No messages yet</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Start the conversation with your team</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {groupedMessages.map(({ message: msg, showHeader }) => {
              const isOwn = msg.senderId === user?.id
              return (
                <div key={msg.id} className={`group ${showHeader ? 'mt-3 first:mt-0' : ''}`}>
                  {showHeader && (
                    <div className="mb-1 flex items-center gap-2">
                      {msg.senderAvatar ? (
                        <img src={msg.senderAvatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
                          style={{ background: 'color-mix(in srgb, var(--primary) 25%, transparent)', color: 'var(--primary)' }}
                        >
                          {(msg.senderName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={`text-xs font-semibold ${isOwn ? 'text-[var(--primary)]' : 'text-[var(--secondary-foreground)]'}`}>
                        {isOwn ? 'You' : msg.senderName || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 pl-7">
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--foreground)]">
                      {msg.content}
                    </p>
                    {isOwn && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="mt-0.5 shrink-0 rounded p-1 text-[var(--muted-foreground)] opacity-0 transition-all hover:text-[var(--error)] group-hover:opacity-100"
                        title="Delete message"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                  {/* Linked project/session badge */}
                  {(msg.linkedProjectName || msg.linkedSessionId) && (
                    <div className="ml-7 mt-1">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)' }}>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.122a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                        {msg.linkedProjectName || 'Linked session'}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3 sm:px-6">
        <div className="flex items-end gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 focus-within:border-[var(--primary)]/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="shrink-0 rounded-md p-1.5 transition-all disabled:opacity-30"
            style={{ color: 'var(--primary)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
