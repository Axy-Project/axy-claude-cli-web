'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Session } from '@axy/shared'
import { api } from '@/lib/api-client'

interface Note {
  id: string
  userId: string
  projectId?: string
  title: string
  content: string
  color: string
  isPinned: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
}

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6']

// ────────────────────────────────────────────────────────────
// Note Card
// ────────────────────────────────────────────────────────────
function NoteCard({
  note,
  onEdit,
  onDelete,
  onPin,
  onSendToChat,
}: {
  note: Note
  onEdit: () => void
  onDelete: () => void
  onPin: () => void
  onSendToChat: () => void
}) {

  return (
    <div
      className="group relative rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--primary)]/30 hover:shadow-md"
      style={{ borderLeftColor: note.color, borderLeftWidth: 3 }}
    >
      {/* Pin indicator */}
      {note.isPinned && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
          </svg>
        </span>
      )}

      <h3 className="truncate font-medium text-[var(--foreground)]">{note.title}</h3>

      <p className="mt-1 line-clamp-3 text-sm text-[var(--muted-foreground)]">
        {note.content || '(empty note)'}
      </p>

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions - show on hover */}
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onSendToChat} className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]" title="Send to Chat">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
        <button onClick={onPin} className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-amber-400" title="Pin">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
          </svg>
        </button>
        <button onClick={onEdit} className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]" title="Edit">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button onClick={onDelete} className="rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400" title="Delete">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="mt-3 text-[10px] text-[var(--muted-foreground)]">
        {new Date(note.updatedAt).toLocaleDateString()}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Note Editor Modal
// ────────────────────────────────────────────────────────────
function NoteEditor({
  note,
  onSave,
  onClose,
}: {
  note?: Note
  onSave: (data: { title: string; content: string; color: string; tags: string[] }) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [color, setColor] = useState(note?.color || '#7c3aed')
  const [tagsInput, setTagsInput] = useState(note?.tags?.join(', ') || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex w-full max-w-2xl flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{note ? 'Edit Note' : 'New Note'}</h3>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
            autoFocus
          />

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here..."
            rows={8}
            className="resize-none rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
          />

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--muted-foreground)]">Color:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags (comma separated)..."
            className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">
            Cancel
          </button>
          <button
            onClick={() => onSave({
              title: title || 'Untitled',
              content,
              color,
              tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
            })}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {note ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main Notes Page
// ────────────────────────────────────────────────────────────
export default function NotesPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const fetchNotes = useCallback(async () => {
    try {
      const data = await api.get<Note[]>(`/api/notes?projectId=${projectId}`)
      setNotes(data)
    } catch (err) {
      console.error('Failed to fetch notes:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const handleCreate = async (data: { title: string; content: string; color: string; tags: string[] }) => {
    try {
      await api.post('/api/notes', { ...data, projectId })
      setShowEditor(false)
      setEditingNote(null)
      fetchNotes()
    } catch (err) {
      console.error('Failed to create note:', err)
    }
  }

  const handleUpdate = async (data: { title: string; content: string; color: string; tags: string[] }) => {
    if (!editingNote) return
    try {
      await api.patch(`/api/notes/${editingNote.id}`, data)
      setShowEditor(false)
      setEditingNote(null)
      fetchNotes()
    } catch (err) {
      console.error('Failed to update note:', err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/notes/${id}`)
      fetchNotes()
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  const handlePin = async (note: Note) => {
    try {
      await api.patch(`/api/notes/${note.id}`, { isPinned: !note.isPinned })
      fetchNotes()
    } catch (err) {
      console.error('Failed to pin note:', err)
    }
  }

  const handleSendToChat = async (note: Note) => {
    try {
      // Create a new chat session
      const session = await api.post<Session>('/api/sessions', { projectId })
      const noteText = `**Note: ${note.title}**\n\n${note.content}`
      router.push(`/projects/${projectId}/chat/${session.id}?prefill=${encodeURIComponent(noteText)}`)
    } catch (err) {
      console.error('Failed to send note to chat:', err)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Notes</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Create notes and send them to chat as context.
          </p>
        </div>
        <button
          onClick={() => { setEditingNote(null); setShowEditor(true) }}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Note
        </button>
      </div>

      {/* Notes grid */}
      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)]/10">
              <svg className="h-6 w-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">No notes yet</p>
            <p className="text-xs text-[var(--muted-foreground)]">Create a note and send it to chat to use it as context</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => { setEditingNote(note); setShowEditor(true) }}
              onDelete={() => handleDelete(note.id)}
              onPin={() => handlePin(note)}
              onSendToChat={() => handleSendToChat(note)}
            />
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <NoteEditor
          note={editingNote || undefined}
          onSave={editingNote ? handleUpdate : handleCreate}
          onClose={() => { setShowEditor(false); setEditingNote(null) }}
        />
      )}
    </div>
  )
}
