'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'

// --- Types ---

interface SearchProject {
  id: string
  name: string
  description: string | null
  createdAt: string
}

interface SearchSession {
  id: string
  projectId: string
  title: string | null
  model: string
  createdAt: string
}

interface SearchMessage {
  id: string
  sessionId: string
  projectId: string
  role: string
  contentJson: unknown[]
  createdAt: string
}

interface SearchNote {
  id: string
  projectId: string | null
  title: string
  content: string
  color: string
  createdAt: string
}

interface SearchResults {
  projects: SearchProject[]
  sessions: SearchSession[]
  messages: SearchMessage[]
  notes: SearchNote[]
}

type SearchType = 'all' | 'projects' | 'sessions' | 'messages' | 'notes'

const TABS: { label: string; value: SearchType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Projects', value: 'projects' },
  { label: 'Sessions', value: 'sessions' },
  { label: 'Messages', value: 'messages' },
  { label: 'Notes', value: 'notes' },
]

// --- Helpers ---

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + query.length)
  const after = text.slice(idx + query.length)
  return (
    <>
      {before}
      <mark className="rounded bg-yellow-500/30 px-0.5 text-[var(--foreground)]">{match}</mark>
      {after}
    </>
  )
}

function extractTextFromContentJson(contentJson: unknown[]): string {
  if (!Array.isArray(contentJson)) return ''
  return contentJson
    .map((block) => {
      if (typeof block === 'string') return block
      if (block && typeof block === 'object' && 'text' in block) return (block as { text: string }).text
      return ''
    })
    .filter(Boolean)
    .join(' ')
    .slice(0, 200)
}

function formatDate(dateStr: string | number): string {
  if (!dateStr) return ''
  const d = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// --- Component ---

export default function SearchPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeType, setActiveType] = useState<SearchType>('all')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(
    async (q: string, type: SearchType) => {
      if (q.length < 2) {
        setResults(null)
        setHasSearched(false)
        return
      }
      setIsLoading(true)
      setHasSearched(true)
      try {
        const data = await api.get<SearchResults>(
          `/api/search?q=${encodeURIComponent(q)}&type=${type}`
        )
        setResults(data)
      } catch {
        setResults(null)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(query, activeType)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeType, doSearch])

  // Autofocus
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Ctrl+/ keyboard shortcut (handled globally in sidebar, but also focus input if already on page)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const totalResults = results
    ? results.projects.length + results.sessions.length + results.messages.length + results.notes.length
    : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Search across projects, sessions, messages, and notes
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-3 pl-10 pr-4 text-base text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveType(tab.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeType === tab.value
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-[var(--muted-foreground)]">
        <kbd className="rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[10px]">Ctrl+K</kbd>{' '}
        command palette{' '}
        <span className="mx-1">|</span>{' '}
        <kbd className="rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[10px]">Ctrl+/</kbd>{' '}
        focus search
      </p>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Searching...
        </div>
      )}

      {/* No results */}
      {!isLoading && hasSearched && totalResults === 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            No results found for &quot;{query}&quot;
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Try a different search term or filter
          </p>
        </div>
      )}

      {/* Results */}
      {!isLoading && results && totalResults > 0 && (
        <div className="space-y-6">
          {/* Projects */}
          {results.projects.length > 0 && (
            <ResultSection
              title="Projects"
              icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              count={results.projects.length}
            >
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="block w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
                >
                  <div className="text-sm font-medium">{highlightMatch(p.name, query)}</div>
                  {p.description && (
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-1">
                      {highlightMatch(p.description, query)}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                    {formatDate(p.createdAt)}
                  </div>
                </button>
              ))}
            </ResultSection>
          )}

          {/* Sessions */}
          {results.sessions.length > 0 && (
            <ResultSection
              title="Sessions"
              icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              count={results.sessions.length}
            >
              {results.sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/projects/${s.projectId}/chat/${s.id}`)}
                  className="block w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
                >
                  <div className="text-sm font-medium">
                    {highlightMatch(s.title || 'Untitled session', query)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                    <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5">{s.model}</span>
                    <span>{formatDate(s.createdAt)}</span>
                  </div>
                </button>
              ))}
            </ResultSection>
          )}

          {/* Messages */}
          {results.messages.length > 0 && (
            <ResultSection
              title="Messages"
              icon="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              count={results.messages.length}
            >
              {results.messages.map((m) => {
                const text = extractTextFromContentJson(m.contentJson)
                return (
                  <button
                    key={m.id}
                    onClick={() =>
                      router.push(`/projects/${m.projectId}/chat/${m.sessionId}`)
                    }
                    className="block w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          m.role === 'user'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}
                      >
                        {m.role}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {formatDate(m.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2">
                      {highlightMatch(text, query)}
                    </div>
                  </button>
                )
              })}
            </ResultSection>
          )}

          {/* Notes */}
          {results.notes.length > 0 && (
            <ResultSection
              title="Notes"
              icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              count={results.notes.length}
            >
              {results.notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() =>
                    router.push(n.projectId ? `/projects/${n.projectId}/notes` : '/projects')
                  }
                  className="block w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: n.color }}
                    />
                    <span className="text-sm font-medium">{highlightMatch(n.title, query)}</span>
                  </div>
                  {n.content && (
                    <div className="mt-0.5 pl-[18px] text-xs text-[var(--muted-foreground)] line-clamp-1">
                      {highlightMatch(n.content.slice(0, 120), query)}
                    </div>
                  )}
                  <div className="mt-1 pl-[18px] text-[10px] text-[var(--muted-foreground)]">
                    {formatDate(n.createdAt)}
                  </div>
                </button>
              ))}
            </ResultSection>
          )}
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function ResultSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <svg
          className="h-4 w-4 text-[var(--muted-foreground)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <span className="text-sm font-semibold">{title}</span>
        <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
          {count}
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]/50">{children}</div>
    </div>
  )
}
