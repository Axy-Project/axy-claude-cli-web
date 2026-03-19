'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import { useTaskStore, type Task, type TaskStatus } from '@/stores/task.store'
import { formatDate } from '@/lib/utils'

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; dot?: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/15', dot: 'bg-yellow-400' },
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-500/15', dot: 'bg-blue-400' },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/15', dot: 'bg-green-400' },
  failed: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/15', dot: 'bg-red-400' },
  cancelled: { label: 'Cancelled', color: 'text-[var(--muted-foreground)]', bg: 'bg-[var(--muted)]/30' },
}

const TYPE_LABELS: Record<string, string> = {
  background_task: 'Background Task',
  slash_command: 'Slash Command',
  subagent: 'Subagent',
}

export default function TasksPage() {
  const params = useParams()
  const projectId = params.id as string
  const { tasks, isLoading, fetchTasks, cancelTask, deleteTask, initWsListeners } = useTaskStore()
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')

  useEffect(() => {
    fetchTasks(projectId)
    const cleanup = initWsListeners()
    return cleanup
  }, [projectId, fetchTasks, initWsListeners])

  const filteredTasks = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)

  const statusCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Tasks</h2>
        <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
          Background tasks, slash commands, and subagent runs for this project
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3">
        {(['all', 'running', 'pending', 'completed', 'failed'] as const).map((status) => {
          const count = status === 'all' ? tasks.length : (statusCounts[status] || 0)
          const isActive = filter === status
          const config = status === 'all' ? null : STATUS_CONFIG[status]

          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-lg border p-3 text-left transition-all ${
                isActive
                  ? 'border-[var(--primary)]/50 bg-[var(--primary)]/5'
                  : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/30'
              }`}
            >
              <div className="text-2xl font-bold text-[var(--foreground)]">{count}</div>
              <div className={`flex items-center gap-1.5 text-xs ${config?.color || 'text-[var(--muted-foreground)]'}`}>
                {config?.dot && (
                  <span className={`h-1.5 w-1.5 rounded-full ${config.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
                )}
                {status === 'all' ? 'All' : config?.label}
              </div>
            </button>
          )
        })}
      </div>

      {/* Tasks list */}
      {isLoading && tasks.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="h-4 w-48 rounded bg-[var(--secondary)]" />
              <div className="mt-2 h-3 w-32 rounded bg-[var(--secondary)]" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredTasks.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <svg className="mx-auto mb-3 h-12 w-12 text-[var(--muted-foreground)]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-[var(--muted-foreground)]">
            {filter === 'all'
              ? 'No tasks yet. Use slash commands in chat to create tasks.'
              : `No ${filter} tasks.`}
          </p>
        </div>
      )}

      {filteredTasks.length > 0 && (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const config = STATUS_CONFIG[task.status]
            const duration = task.durationMs
              ? task.durationMs >= 1000
                ? `${(task.durationMs / 1000).toFixed(1)}s`
                : `${task.durationMs}ms`
              : null

            return (
              <div
                key={task.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-medium text-[var(--foreground)]">
                        {task.title}
                      </h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color} ${config.bg}`}>
                        {task.status === 'running' && (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                        )}
                        {config.label}
                      </span>
                    </div>

                    {task.description && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {task.description}
                      </p>
                    )}

                    {task.command && (
                      <div className="mt-1.5 inline-block rounded bg-[var(--secondary)] px-2 py-0.5">
                        <code className="font-mono text-[11px] text-[var(--primary)]">
                          /{task.command}
                        </code>
                      </div>
                    )}

                    {task.status === 'running' && task.progress > 0 && (
                      <div className="mt-2 max-w-xs">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
                          <div
                            className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                            style={{ width: `${Math.min(task.progress, 100)}%` }}
                          />
                        </div>
                        <span className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                          {task.progress}%
                        </span>
                      </div>
                    )}

                    {task.result && task.status === 'completed' && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-green-400">
                          View result
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-[var(--secondary)] p-2 font-mono text-[11px] text-[var(--muted-foreground)]">
                          {task.result}
                        </pre>
                      </details>
                    )}

                    {task.error && (
                      <details className="mt-2" open>
                        <summary className="cursor-pointer text-xs font-medium text-red-400">
                          Error details
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-red-500/5 p-2 font-mono text-[11px] text-red-400/80">
                          {task.error}
                        </pre>
                      </details>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
                      <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono">
                        {TYPE_LABELS[task.type] || task.type}
                      </span>
                      {duration && <span>{duration}</span>}
                      <span>{formatDate(task.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {(task.status === 'pending' || task.status === 'running') && (
                      <button
                        onClick={() => cancelTask(task.id)}
                        className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                      >
                        Cancel
                      </button>
                    )}
                    {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && (
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
