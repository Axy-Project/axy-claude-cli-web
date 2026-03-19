'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useAgentStore } from '@/stores/agent.store'

// ─── Types ──────────────────────────────────────────────

export interface BuiltInAgent {
  id: string
  name: string
  role: string
  description: string
  systemPrompt: string
  model: string
  icon: string
  color: string
}

export interface RoutingResult {
  agent: BuiltInAgent | null
  reasoning: string
  suggestedModel?: string
}

// ─── Agent Orchestration Panel ──────────────────────────

interface AgentOrchestrationPanelProps {
  activeAgent: BuiltInAgent | null
  reasoning: string | null
  onDismiss: () => void
  onOverride: (agentId: string) => void
  isVisible: boolean
}

export function AgentOrchestrationPanel({
  activeAgent,
  reasoning,
  onDismiss,
  onOverride,
  isVisible,
}: AgentOrchestrationPanelProps) {
  const [showAgentList, setShowAgentList] = useState(false)
  const [builtInAgents, setBuiltInAgents] = useState<BuiltInAgent[]>([])
  const { agents: customAgents, fetchAgents } = useAgentStore()

  // Fetch built-in agents + custom agents when override list is opened
  useEffect(() => {
    if (showAgentList) {
      if (builtInAgents.length === 0) {
        api.get<BuiltInAgent[]>('/api/agents/built-in').then(setBuiltInAgents).catch(() => {})
      }
      if (customAgents.length === 0) {
        fetchAgents()
      }
    }
  }, [showAgentList, builtInAgents.length, customAgents.length, fetchAgents])

  if (!isVisible || !activeAgent) return null

  const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
    orchestrator: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    researcher: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    coder: { bg: 'bg-green-500/15', text: 'text-green-400' },
    tester: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
    reviewer: { bg: 'bg-rose-500/15', text: 'text-rose-400' },
    general: { bg: 'bg-slate-500/15', text: 'text-slate-400' },
  }

  const roleStyle = ROLE_STYLES[activeAgent.role] || ROLE_STYLES.general

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      {/* Active agent header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Agent icon */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: activeAgent.color + '20' }}
        >
          {activeAgent.icon}
        </div>

        {/* Agent info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {activeAgent.name}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${roleStyle.bg} ${roleStyle.text}`}
            >
              {activeAgent.role}
            </span>
          </div>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {activeAgent.description}
          </p>
        </div>

        {/* Model badge */}
        <div className="shrink-0 rounded border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)]">
          {activeAgent.model}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowAgentList(!showAgentList)}
            title="Switch agent"
            className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
          <button
            onClick={onDismiss}
            title="Dismiss agent"
            className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Reasoning section */}
      {reasoning && (
        <div className="border-t border-[var(--border)] bg-[var(--secondary)]/30 px-4 py-2">
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-3 w-3 shrink-0 text-[var(--muted-foreground)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              {reasoning}
            </p>
          </div>
        </div>
      )}

      {/* Agent override list */}
      {showAgentList && (
        <div className="border-t border-[var(--border)] bg-[var(--secondary)]/20">
          <div className="px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Switch to agent
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto pb-2">
            {builtInAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  onOverride(agent.id)
                  setShowAgentList(false)
                }}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-[var(--accent)] ${
                  agent.id === activeAgent.id ? 'bg-[var(--primary)]/5' : ''
                }`}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
                  style={{ backgroundColor: agent.color + '20' }}
                >
                  {agent.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-[var(--foreground)]">
                    {agent.name}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--muted-foreground)]">
                    {agent.description}
                  </span>
                </div>
                {agent.id === activeAgent.id && (
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
            {/* Custom agents from user's library */}
            {customAgents.filter(a => a.isActive !== false).length > 0 && (
              <>
                <div className="mx-4 my-1 border-t border-[var(--border)]" />
                <div className="px-4 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Your agents
                  </p>
                </div>
                {customAgents.filter(a => a.isActive !== false).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onOverride(agent.id)
                      setShowAgentList(false)
                    }}
                    className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-[var(--accent)] ${
                      agent.id === activeAgent.id ? 'bg-[var(--primary)]/5' : ''
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
                      style={{ backgroundColor: (agent.color || '#6366f1') + '20' }}
                    >
                      {agent.icon || '🤖'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-[var(--foreground)]">
                        {agent.name}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--muted-foreground)]">
                        {agent.description || agent.role || 'Custom agent'}
                      </span>
                    </div>
                    {agent.id === activeAgent.id && (
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hook: useOrchestrator ──────────────────────────────

export function useOrchestrator() {
  const [activeAgent, setActiveAgent] = useState<BuiltInAgent | null>(null)
  const [reasoning, setReasoning] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyzeMessage = useCallback(async (message: string, projectId?: string, sessionId?: string) => {
    // Skip analysis for very short messages or slash commands
    if (message.length < 5 || message.startsWith('/')) {
      return null
    }

    setIsAnalyzing(true)
    try {
      const result = await api.post<RoutingResult>('/api/agents/analyze', {
        message,
        projectId,
        sessionId,
      })
      if (result.agent) {
        setActiveAgent(result.agent)
        setReasoning(result.reasoning)
      }
      return result
    } catch {
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const setAgent = useCallback((agent: BuiltInAgent | null, reason?: string) => {
    setActiveAgent(agent)
    setReasoning(reason || null)
  }, [])

  const dismissAgent = useCallback(() => {
    setActiveAgent(null)
    setReasoning(null)
  }, [])

  const overrideAgent = useCallback(async (agentId: string) => {
    try {
      // Try built-in agents first
      const agents = await api.get<BuiltInAgent[]>('/api/agents/built-in')
      const builtIn = agents.find((a) => a.id === agentId)
      if (builtIn) {
        setActiveAgent(builtIn)
        setReasoning(`Manually activated ${builtIn.name} agent.`)
        return
      }
      // Try custom agents from the store
      const customAgents = useAgentStore.getState().agents
      const custom = customAgents.find((a) => a.id === agentId)
      if (custom) {
        setActiveAgent({
          id: custom.id,
          name: custom.name,
          role: custom.role || 'general',
          description: custom.description || '',
          systemPrompt: custom.systemPrompt || '',
          model: custom.model || 'claude-sonnet-4-6',
          icon: custom.icon || '🤖',
          color: custom.color || '#6366f1',
        })
        setReasoning(`Manually activated ${custom.name} agent.`)
      }
    } catch {
      // ignore
    }
  }, [])

  return {
    activeAgent,
    reasoning,
    isAnalyzing,
    analyzeMessage,
    setAgent,
    dismissAgent,
    overrideAgent,
  }
}
