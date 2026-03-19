'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'

interface UsageSummary {
  totalInputTokens: number
  totalOutputTokens: number
  sessionsCount: number
  todayInputTokens: number
  todayOutputTokens: number
}

interface ProjectUsage {
  projectId: string
  projectName: string
  totalInput: number
  totalOutput: number
  sessionCount: number
}

interface ActivityItem {
  id: string
  type: 'session_created' | 'message_sent' | 'task_completed' | 'commit' | 'snapshot_created' | 'project_created'
  title: string
  description?: string
  projectId?: string
  projectName?: string
  createdAt: string
  metadata?: Record<string, unknown>
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  switch (type) {
    case 'session_created':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    case 'message_sent':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    case 'task_completed':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'project_created':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    default:
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}

function getActivityColor(type: ActivityItem['type']): string {
  switch (type) {
    case 'session_created': return 'bg-blue-500/15 text-blue-400'
    case 'message_sent': return 'bg-green-500/15 text-green-400'
    case 'task_completed': return 'bg-emerald-500/15 text-emerald-400'
    case 'project_created': return 'bg-purple-500/15 text-purple-400'
    default: return 'bg-gray-500/15 text-gray-400'
  }
}

function getActivityLink(item: ActivityItem): string | null {
  switch (item.type) {
    case 'session_created':
    case 'message_sent': {
      const sessionId = item.metadata?.sessionId as string | undefined
      if (item.projectId && sessionId) {
        return `/projects/${item.projectId}/chat/${sessionId}`
      }
      return item.projectId ? `/projects/${item.projectId}/chat` : null
    }
    case 'task_completed':
      return item.projectId ? `/projects/${item.projectId}/chat` : null
    case 'project_created':
      return item.projectId ? `/projects/${item.projectId}` : null
    default:
      return null
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [byProject, setByProject] = useState<ProjectUsage[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [summaryData, projectData, activityData] = await Promise.all([
        api.get<UsageSummary>('/api/usage/summary'),
        api.get<ProjectUsage[]>('/api/usage/by-project'),
        api.get<ActivityItem[]>('/api/activity?limit=20').catch(() => [] as ActivityItem[]),
      ])
      setSummary(summaryData)
      setByProject(projectData)
      setActivity(activityData)
    } catch {
      // Data will remain at defaults
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalTokens = summary ? summary.totalInputTokens + summary.totalOutputTokens : 0
  const todayTokens = summary ? summary.todayInputTokens + summary.todayOutputTokens : 0
  const avgTokensPerSession =
    summary && summary.sessionsCount > 0
      ? Math.round(totalTokens / summary.sessionsCount)
      : 0

  const topProjects = byProject.slice(0, 3)
  const maxProjectTokens = Math.max(...topProjects.map((p) => p.totalInput + p.totalOutput), 1)

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="font-headline text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-[0.75rem] bg-[#1a1a1a] p-6">
              <div className="h-3 w-20 rounded bg-[#262626]" />
              <div className="mt-3 h-8 w-24 rounded bg-[#262626]" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-[#adaaaa]">Token usage overview and recent activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[0.75rem] bg-[#1a1a1a] p-5">
          <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-[#adaaaa]">Today</p>
          <p className="mt-2 font-headline text-2xl font-bold text-white">{formatTokens(todayTokens)}</p>
          <p className="mt-1 text-xs text-[#adaaaa]">
            {formatTokens(summary?.todayInputTokens ?? 0)} in · {formatTokens(summary?.todayOutputTokens ?? 0)} out
          </p>
        </div>
        <div className="rounded-[0.75rem] bg-[#1a1a1a] p-5">
          <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-[#adaaaa]">Total Tokens</p>
          <p className="mt-2 font-headline text-2xl font-bold text-white">{formatTokens(totalTokens)}</p>
          <p className="mt-1 text-xs text-[#adaaaa]">
            {formatTokens(summary?.totalInputTokens ?? 0)} in · {formatTokens(summary?.totalOutputTokens ?? 0)} out
          </p>
        </div>
        <div className="rounded-[0.75rem] bg-[#1a1a1a] p-5">
          <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-[#adaaaa]">Sessions</p>
          <p className="mt-2 font-headline text-2xl font-bold text-white">{summary?.sessionsCount ?? 0}</p>
        </div>
        <div className="rounded-[0.75rem] bg-[#1a1a1a] p-5">
          <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-[#adaaaa]">Avg / Session</p>
          <p className="mt-2 font-headline text-2xl font-bold text-white">{formatTokens(avgTokensPerSession)}</p>
        </div>
      </div>

      {/* Recent Activity Feed */}
      {activity.length > 0 && (
        <div className="rounded-[0.75rem] bg-[#1a1a1a] p-5">
          <h2 className="mb-4 font-headline text-base font-semibold text-white">Recent Activity</h2>
          <div className="space-y-1">
            {activity.map((item) => {
              const link = getActivityLink(item)
              const colorClass = getActivityColor(item.type)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => link && router.push(link)}
                  disabled={!link}
                  className="flex w-full items-start gap-3 rounded-[0.375rem] px-2 py-2 text-left transition-colors hover:bg-[#262626]/60 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                    <ActivityIcon type={item.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--foreground)]">
                        {item.title}
                      </span>
                      {item.projectName && (
                        <span className="shrink-0 rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
                          {item.projectName}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 pt-0.5 text-[10px] text-[var(--muted-foreground)]">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Top 3 Projects by Usage */}
      {topProjects.length > 0 && (
        <div className="rounded-[0.75rem] bg-[#1a1a1a] p-5">
          <h2 className="mb-4 font-headline text-base font-semibold text-white">Top Projects by Usage</h2>
          <div className="space-y-2">
            {topProjects.map((p) => {
              const projectTokens = p.totalInput + p.totalOutput
              const pct = (projectTokens / maxProjectTokens) * 100
              return (
                <div key={p.projectId}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-white">{p.projectName}</span>
                    <span className="ml-2 shrink-0 text-xs text-[#adaaaa]">
                      {formatTokens(projectTokens)} tokens
                    </span>
                  </div>
                  <div className="relative h-1 w-full overflow-hidden rounded-full bg-[#262626]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#bd9dff]"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
