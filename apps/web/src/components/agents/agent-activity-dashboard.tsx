'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { uuid } from '@/lib/utils'
import { useAgentStore } from '@/stores/agent.store'
import type { AgentProfile } from '@axy/shared'
import { MODELS } from '@axy/shared'

// ─── Types ──────────────────────────────────────────────

interface BuiltInAgent {
  id: string
  name: string
  role: string
  description: string
  systemPrompt: string
  model: string
  icon: string
  color: string
}

interface ActivityLogEntry {
  id: string
  agentId: string
  agentName: string
  agentIcon: string
  action: string
  timestamp: Date
}

// ─── Constants ──────────────────────────────────────────

const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
  orchestrator: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  researcher: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  coder: { bg: 'bg-green-500/15', text: 'text-green-400' },
  tester: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  reviewer: { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  general: { bg: 'bg-slate-500/15', text: 'text-slate-400' },
}

const MODEL_TIER_COLORS: Record<string, string> = {
  premium: 'text-amber-400',
  standard: 'text-blue-400',
  fast: 'text-green-400',
}

function getModelName(modelId: string): string {
  const model = MODELS.find((m) => m.id === modelId)
  return model?.name ?? modelId
}

function getModelTier(modelId: string): string {
  const model = MODELS.find((m) => m.id === modelId)
  return model?.tier ?? 'standard'
}

// ─── Built-in Agent Card ────────────────────────────────

function BuiltInAgentCard({
  agent,
  onActivate,
}: {
  agent: BuiltInAgent
  onActivate: (agent: BuiltInAgent) => void
}) {
  const roleStyle = ROLE_STYLES[agent.role] || ROLE_STYLES.general
  const modelTier = getModelTier(agent.model)

  return (
    <div className="group relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--primary)]/40 hover:shadow-lg hover:shadow-[var(--primary)]/5">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: agent.color + '20' }}
          >
            {agent.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight text-[var(--foreground)]">
              {agent.name}
            </h3>
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${roleStyle.bg} ${roleStyle.text}`}
            >
              {agent.role}
            </span>
          </div>
        </div>
        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
          built-in
        </span>
      </div>

      {/* Description */}
      <p className="mb-3 line-clamp-2 text-xs text-[var(--muted-foreground)]">
        {agent.description}
      </p>

      {/* Model tag */}
      <div className="mb-3 flex items-center gap-1.5">
        <span
          className={`rounded bg-[var(--secondary)] px-2 py-0.5 text-[10px] font-medium ${
            MODEL_TIER_COLORS[modelTier] || 'text-[var(--muted-foreground)]'
          }`}
        >
          {getModelName(agent.model)}
        </span>
      </div>

      {/* Activate button */}
      <div className="mt-auto pt-2">
        <button
          onClick={() => onActivate(agent)}
          className="w-full rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15"
        >
          Activate
        </button>
      </div>
    </div>
  )
}

// ─── Custom Agent Card ──────────────────────────────────

function CustomAgentCard({
  agent,
  onActivate,
}: {
  agent: AgentProfile
  onActivate: (agent: AgentProfile) => void
}) {
  const roleStyle = ROLE_STYLES[agent.role] || ROLE_STYLES.general
  const modelTier = getModelTier(agent.model)

  return (
    <div className="group relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--primary)]/40 hover:shadow-lg hover:shadow-[var(--primary)]/5">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: (agent.color || '#7c3aed') + '20' }}
          >
            {agent.icon || agent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight text-[var(--foreground)]">
              {agent.name}
            </h3>
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${roleStyle.bg} ${roleStyle.text}`}
            >
              {agent.role}
            </span>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            agent.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          {agent.isActive ? 'active' : 'inactive'}
        </span>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="mb-3 line-clamp-2 text-xs text-[var(--muted-foreground)]">
          {agent.description}
        </p>
      )}

      {/* Tags */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded bg-[var(--secondary)] px-2 py-0.5 text-[10px] font-medium ${
            MODEL_TIER_COLORS[modelTier] || 'text-[var(--muted-foreground)]'
          }`}
        >
          {getModelName(agent.model)}
        </span>
        {agent.extendedThinking && (
          <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-400">
            thinking
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-2 text-[10px] text-[var(--muted-foreground)]">
        <span>{agent.totalTasksCompleted} tasks</span>
      </div>

      {/* Activate button */}
      <div className="mt-2">
        <button
          onClick={() => onActivate(agent)}
          className="w-full rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15"
        >
          Activate
        </button>
      </div>
    </div>
  )
}

// ─── Activity Log ───────────────────────────────────────

function ActivityLog({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          No recent agent activity. Agents will appear here when activated.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--secondary)]/50"
        >
          <span className="text-sm">{entry.agentIcon}</span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-[var(--foreground)]">
              {entry.agentName}
            </span>
            <span className="mx-1.5 text-[10px] text-[var(--muted-foreground)]">-</span>
            <span className="text-xs text-[var(--muted-foreground)]">{entry.action}</span>
          </div>
          <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">
            {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────

interface AgentActivityDashboardProps {
  onAgentActivate?: (agentId: string, agentType: 'built-in' | 'custom') => void
}

export function AgentActivityDashboard({ onAgentActivate }: AgentActivityDashboardProps) {
  const [builtInAgents, setBuiltInAgents] = useState<BuiltInAgent[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'built-in' | 'custom' | 'activity'>('built-in')

  const { agents: customAgents, fetchAgents } = useAgentStore()

  // Fetch data on mount
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [agents] = await Promise.all([
          api.get<BuiltInAgent[]>('/api/agents/built-in'),
          fetchAgents(),
        ])
        setBuiltInAgents(agents)
      } catch {
        // ignore
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [fetchAgents])

  const handleBuiltInActivate = useCallback(
    (agent: BuiltInAgent) => {
      // Add to activity log
      setActivityLog((prev) => [
        {
          id: uuid(),
          agentId: agent.id,
          agentName: agent.name,
          agentIcon: agent.icon,
          action: 'Activated',
          timestamp: new Date(),
        },
        ...prev,
      ])
      onAgentActivate?.(agent.id, 'built-in')
    },
    [onAgentActivate]
  )

  const handleCustomActivate = useCallback(
    (agent: AgentProfile) => {
      // Add to activity log
      setActivityLog((prev) => [
        {
          id: uuid(),
          agentId: agent.id,
          agentName: agent.name,
          agentIcon: agent.icon || agent.name.charAt(0),
          action: 'Activated',
          timestamp: new Date(),
        },
        ...prev,
      ])
      onAgentActivate?.(agent.id, 'custom')
    },
    [onAgentActivate]
  )

  const tabs = [
    { id: 'built-in' as const, label: 'Built-in', count: builtInAgents.length },
    { id: 'custom' as const, label: 'Custom', count: customAgents.length },
    { id: 'activity' as const, label: 'Activity', count: activityLog.length },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Agent Dashboard</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Available agents and recent activity
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === tab.id
                    ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-8 text-center">
          <div className="animate-pulse text-sm text-[var(--muted-foreground)]">
            Loading agents...
          </div>
        </div>
      ) : (
        <>
          {/* Built-in Agents Grid */}
          {activeTab === 'built-in' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {builtInAgents.map((agent) => (
                <BuiltInAgentCard
                  key={agent.id}
                  agent={agent}
                  onActivate={handleBuiltInActivate}
                />
              ))}
            </div>
          )}

          {/* Custom Agents Grid */}
          {activeTab === 'custom' && (
            <>
              {customAgents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No custom agents yet. Create one from the Agents page.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {customAgents.map((agent) => (
                    <CustomAgentCard
                      key={agent.id}
                      agent={agent}
                      onActivate={handleCustomActivate}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Activity Log */}
          {activeTab === 'activity' && <ActivityLog entries={activityLog} />}
        </>
      )}
    </div>
  )
}
