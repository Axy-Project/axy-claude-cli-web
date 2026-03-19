'use client'

import { useEffect, useState } from 'react'
import { useTaskStore, type Task, type TaskStatus } from '@/stores/task.store'
import { formatDate } from '@/lib/utils'

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/15' },
  failed: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/15' },
  cancelled: { label: 'Cancelled', color: 'text-[var(--muted-foreground)]', bg: 'bg-[var(--muted)]/30' },
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color} ${config.bg}`}>
      {status === 'running' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
      )}
      {config.label}
    </span>
  )
}

function ProgressBar({ progress }: { progress: number }) {
  if (progress <= 0) return null
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
      <div
        className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  )
}

function TaskItem({ task }: { task: Task }) {
  const { cancelTask, deleteTask } = useTaskStore()

  const duration = task.durationMs
    ? task.durationMs >= 1000
      ? `${(task.durationMs / 1000).toFixed(1)}s`
      : `${task.durationMs}ms`
    : null

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-medium text-[var(--foreground)]">
              {task.title}
            </h4>
            <TaskStatusBadge status={task.status} />
          </div>

          {task.description && (
            <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
              {task.description}
            </p>
          )}

          {task.command && (
            <div className="mt-1 rounded bg-[var(--secondary)] px-2 py-0.5">
              <code className="font-mono text-[11px] text-[var(--primary)]">
                /{task.command}
              </code>
            </div>
          )}

          {task.status === 'running' && task.progress > 0 && (
            <div className="mt-2">
              <ProgressBar progress={task.progress} />
              <span className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                {task.progress}%
              </span>
            </div>
          )}

          {task.result && task.status === 'completed' && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] font-medium text-green-400">
                View result
              </summary>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-[var(--secondary)] p-2 font-mono text-[11px] text-[var(--muted-foreground)]">
                {task.result}
              </pre>
            </details>
          )}

          {task.error && (
            <details className="mt-2" open>
              <summary className="cursor-pointer text-[10px] font-medium text-red-400">
                Error
              </summary>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-red-500/5 p-2 font-mono text-[11px] text-red-400/80">
                {task.error}
              </pre>
            </details>
          )}

          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
            <span className="rounded bg-[var(--secondary)] px-1 py-0.5 font-mono">
              {task.type.replace('_', ' ')}
            </span>
            {duration && <span>{duration}</span>}
            <span>{formatDate(task.createdAt)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {(task.status === 'pending' || task.status === 'running') && (
            <button
              onClick={() => cancelTask(task.id)}
              className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
              title="Cancel task"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && (
            <button
              onClick={() => deleteTask(task.id)}
              className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
              title="Delete task"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface TaskPanelProps {
  projectId: string
  sessionId?: string
}

function CreateTaskForm({ projectId, sessionId, onClose }: { projectId: string; sessionId?: string; onClose: () => void }) {
  const { createTask } = useTaskStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setIsSubmitting(true)
    try {
      await createTask({ projectId, sessionId, title: title.trim(), description: description.trim() || undefined })
      onClose()
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--background)] p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose() }}
        placeholder="Task title..."
        className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full resize-none rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded px-3 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || isSubmitting}
          className="rounded bg-[var(--primary)] px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}

export function TaskPanel({ projectId, sessionId }: TaskPanelProps) {
  const { tasks, isLoading, isPanelOpen, fetchTasks, fetchSessionTasks, togglePanel, initWsListeners } =
    useTaskStore()
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (sessionId) {
      fetchSessionTasks(sessionId)
    } else {
      fetchTasks(projectId)
    }
    const cleanup = initWsListeners()
    return cleanup
  }, [projectId, sessionId, fetchTasks, fetchSessionTasks, initWsListeners])

  const runningCount = tasks.filter((t) => t.status === 'running').length
  const pendingCount = tasks.filter((t) => t.status === 'pending').length

  return (
    <div>
      {/* Toggle button */}
      <button
        onClick={togglePanel}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        Tasks
        {(runningCount > 0 || pendingCount > 0) && (
          <span className="flex items-center gap-1">
            {runningCount > 0 && (
              <span className="flex items-center gap-0.5 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-400">
                <span className="h-1 w-1 animate-pulse rounded-full bg-blue-400" />
                {runningCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[10px] text-yellow-400">
                {pendingCount}
              </span>
            )}
          </span>
        )}
      </button>

      {/* Panel */}
      {isPanelOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-96 max-h-[70vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Tasks ({tasks.length})
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                title="New task"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={togglePanel}
                className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2">
            {showCreateForm && (
              <CreateTaskForm
                projectId={projectId}
                sessionId={sessionId}
                onClose={() => setShowCreateForm(false)}
              />
            )}

            {isLoading && tasks.length === 0 && (
              <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                Loading tasks...
              </div>
            )}

            {!isLoading && tasks.length === 0 && !showCreateForm && (
              <div className="py-8 text-center">
                <svg className="mx-auto mb-2 h-8 w-8 text-[var(--muted-foreground)]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-xs text-[var(--muted-foreground)]">
                  No tasks yet
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-2 rounded bg-[var(--primary)] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  Create task
                </button>
              </div>
            )}

            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
