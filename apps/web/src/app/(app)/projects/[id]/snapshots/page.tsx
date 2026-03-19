'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────

interface Snapshot {
  id: string
  name: string
  description: string
  createdAt: string
  commitHash: string
}

interface SnapshotDiffFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

interface SnapshotDiff {
  files: SnapshotDiffFile[]
  summary: string
}

// ─── Status colors ──────────────────────────────────────

const DIFF_STATUS_CONFIG: Record<SnapshotDiffFile['status'], { letter: string; color: string }> = {
  added: { letter: 'A', color: 'text-green-400' },
  modified: { letter: 'M', color: 'text-yellow-400' },
  deleted: { letter: 'D', color: 'text-red-400' },
  renamed: { letter: 'R', color: 'text-blue-400' },
}

// ─── Diff Modal ─────────────────────────────────────────

function DiffModal({
  snapshot,
  diff,
  onClose,
}: {
  snapshot: Snapshot
  diff: SnapshotDiff
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Diff: {snapshot.name}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Changes between snapshot and current HEAD
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {diff.files.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No changes found.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {diff.files.map((file) => {
                  const cfg = DIFF_STATUS_CONFIG[file.status]
                  return (
                    <li
                      key={file.path}
                      className="flex items-center gap-2 font-mono text-sm text-[var(--foreground)]"
                    >
                      <span className={`w-4 text-center text-xs font-bold ${cfg.color}`}>
                        {cfg.letter}
                      </span>
                      <span className="truncate">{file.path}</span>
                    </li>
                  )
                })}
              </ul>

              {/* Stat summary */}
              {diff.summary && (
                <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-[var(--secondary)] p-3 font-mono text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {diff.summary}
                </pre>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[var(--border)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Dialog ─────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 py-1.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/90 disabled:opacity-50"
          >
            {isLoading && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────

export default function ProjectSnapshotsPage() {
  const params = useParams()
  const projectId = params.id as string

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Restore confirmation
  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Snapshot | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Diff modal
  const [diffTarget, setDiffTarget] = useState<Snapshot | null>(null)
  const [diffData, setDiffData] = useState<SnapshotDiff | null>(null)
  const [isDiffLoading, setIsDiffLoading] = useState(false)

  // ─── Fetch snapshots ────────────────────────────────

  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.get<Snapshot[]>(`/api/snapshots/project/${projectId}`)
      setSnapshots(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  // ─── Create ─────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    setIsCreating(true)
    setError(null)
    try {
      await api.post<Snapshot>(`/api/snapshots/project/${projectId}`, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      setName('')
      setDescription('')
      await fetchSnapshots()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsCreating(false)
    }
  }, [projectId, name, description, fetchSnapshots])

  // ─── Restore ────────────────────────────────────────

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return
    setIsRestoring(true)
    setError(null)
    try {
      const data = await api.post<{ branchName: string }>(
        `/api/snapshots/project/${projectId}/restore/${encodeURIComponent(restoreTarget.id)}`
      )
      setRestoreTarget(null)
      await fetchSnapshots()
      setError(null)
      alert(`Restored to branch: ${data.branchName}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsRestoring(false)
    }
  }, [projectId, restoreTarget, fetchSnapshots])

  // ─── Delete ─────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setError(null)
    try {
      await api.delete(
        `/api/snapshots/project/${projectId}/${encodeURIComponent(deleteTarget.id)}`
      )
      setDeleteTarget(null)
      await fetchSnapshots()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsDeleting(false)
    }
  }, [projectId, deleteTarget, fetchSnapshots])

  // ─── Diff ───────────────────────────────────────────

  const handleViewDiff = useCallback(
    async (snapshot: Snapshot) => {
      setDiffTarget(snapshot)
      setIsDiffLoading(true)
      try {
        const data = await api.get<SnapshotDiff>(
          `/api/snapshots/project/${projectId}/diff/${encodeURIComponent(snapshot.id)}`
        )
        setDiffData(data)
      } catch (err) {
        setError((err as Error).message)
        setDiffTarget(null)
      } finally {
        setIsDiffLoading(false)
      }
    },
    [projectId]
  )

  // ─── Loading state ──────────────────────────────────

  if (isLoading && snapshots.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="h-4 w-40 rounded bg-[var(--secondary)]" />
            <div className="mt-3 h-3 w-64 rounded bg-[var(--secondary)]" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Snapshots</h2>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            Save and restore workspace state
          </p>
        </div>
        <button
          onClick={fetchSnapshots}
          disabled={isLoading}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 px-4 py-3">
          <span className="text-sm text-[var(--destructive)]">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-3 text-xs text-[var(--destructive)] underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create snapshot form */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">Create Snapshot</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Snapshot name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <button
              onClick={handleCreate}
              disabled={isCreating || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/90 disabled:opacity-50"
            >
              {isCreating ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
              Create
            </button>
          </div>
          <input
            type="text"
            placeholder="Description (optional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          Snapshots stage all current files and create a tagged commit.
        </p>
      </div>

      {/* Snapshots list */}
      {snapshots.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No snapshots yet. Create one to save the current workspace state.
          </p>
        </div>
      ) : (
        <div className="space-y-0 rounded-lg border border-[var(--border)] bg-[var(--card)]">
          {snapshots.map((snapshot, i) => (
            <div
              key={snapshot.id}
              className={`flex items-start gap-4 px-5 py-4 ${
                i < snapshots.length - 1 ? 'border-b border-[var(--border)]' : ''
              }`}
            >
              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-sm font-medium text-[var(--foreground)]">
                    {snapshot.name}
                  </h4>
                  <span className="shrink-0 rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--primary)]">
                    {snapshot.commitHash.slice(0, 7)}
                  </span>
                </div>
                {snapshot.description && (
                  <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                    {snapshot.description}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  {formatDate(snapshot.createdAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => handleViewDiff(snapshot)}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]"
                >
                  Diff
                </button>
                <button
                  onClick={() => setRestoreTarget(snapshot)}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]"
                >
                  Restore
                </button>
                <button
                  onClick={() => setDeleteTarget(snapshot)}
                  className="rounded-md border border-[var(--destructive)]/30 bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restore confirmation dialog */}
      {restoreTarget && (
        <ConfirmDialog
          title="Restore Snapshot"
          message={`This will stash any current changes and create a new branch from snapshot "${restoreTarget.name}". Do you want to continue?`}
          confirmLabel="Restore"
          onConfirm={handleRestore}
          onCancel={() => setRestoreTarget(null)}
          isLoading={isRestoring}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Snapshot"
          message={`Are you sure you want to delete snapshot "${deleteTarget.name}"? This will remove the git tag. The commit will remain in the history.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={isDeleting}
        />
      )}

      {/* Diff modal */}
      {diffTarget && diffData && !isDiffLoading && (
        <DiffModal
          snapshot={diffTarget}
          diff={diffData}
          onClose={() => {
            setDiffTarget(null)
            setDiffData(null)
          }}
        />
      )}

      {/* Diff loading overlay */}
      {isDiffLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-6 py-4 shadow-xl">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            <span className="text-sm text-[var(--foreground)]">Loading diff...</span>
          </div>
        </div>
      )}
    </div>
  )
}
