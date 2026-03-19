'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import ReactMarkdown from 'react-markdown'

interface ClaudeMdData {
  content: string
  source: 'file' | 'database' | 'none'
  path: string
}

export default function ContextPage() {
  const params = useParams()
  const projectId = params.id as string
  const [data, setData] = useState<ClaudeMdData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchClaudeMd = useCallback(async () => {
    try {
      const result = await api.get<ClaudeMdData>(`/api/projects/${projectId}/claude-md`)
      setData(result)
      setEditContent(result.content)
    } catch (err) {
      console.error('Failed to fetch CLAUDE.md:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchClaudeMd()
  }, [fetchClaudeMd])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/api/projects/${projectId}/claude-md`, { content: editContent })
      setData((prev) => prev ? { ...prev, content: editContent, source: 'file' } : prev)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save CLAUDE.md:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-[var(--muted-foreground)]">Loading CLAUDE.md...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Project Context (CLAUDE.md)</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {data?.source === 'file' && (
              <span>Reading from <code className="rounded bg-[var(--secondary)] px-1 py-0.5 text-xs">{data.path}</code></span>
            )}
            {data?.source === 'database' && 'Stored in database (no CLAUDE.md file found)'}
            {data?.source === 'none' && 'No CLAUDE.md found. Create one to give Claude context about your project.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-400">Saved!</span>
          )}
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setEditContent(data?.content || '') }}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">CLAUDE.md</span>
            <span className="text-[10px] text-[var(--muted-foreground)]">Markdown</span>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-0 flex-1 resize-none bg-[var(--card)] p-4 font-mono text-sm text-[var(--foreground)] outline-none"
            placeholder="# Project Context\n\nDescribe your project, coding conventions, architecture decisions..."
            spellCheck={false}
          />
        </div>
      ) : data?.content ? (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-[var(--foreground)] prose-p:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-code:rounded prose-code:bg-[var(--secondary)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[var(--primary)] prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-[var(--secondary)] prose-pre:border prose-pre:border-[var(--border)] prose-a:text-[var(--primary)] prose-li:text-[var(--foreground)]">
            <ReactMarkdown>{data.content}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)]/10">
              <svg className="h-6 w-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">No CLAUDE.md file found</p>
            <button
              onClick={() => { setEditContent('# Project Context\n\n'); setEditing(true) }}
              className="mt-2 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Create one now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
