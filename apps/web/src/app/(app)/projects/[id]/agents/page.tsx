'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAgentStore } from '@/stores/agent.store'
import { useProjectStore } from '@/stores/project.store'
import { formatDate } from '@/lib/utils'
import { AGENT_ROLES, PERMISSION_MODES, MODELS, DEFAULT_MODEL } from '@axy/shared'
import type { AgentProfile, CreateAgentInput, AgentRole } from '@axy/shared'

// ─── Role badge colors ──────────────────────────────────
const ROLE_COLORS: Record<AgentRole, { bg: string; text: string }> = {
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
  const model = MODELS.find(m => m.id === modelId)
  return model?.name ?? modelId
}

function getModelTier(modelId: string): string {
  const model = MODELS.find(m => m.id === modelId)
  return model?.tier ?? 'standard'
}

// ─── Default form values ────────────────────────────────
function getDefaultForm(orgId?: string): CreateAgentInput {
  return {
    name: '',
    description: '',
    icon: '',
    color: '#7c3aed',
    role: 'general',
    model: DEFAULT_MODEL,
    systemPrompt: '',
    permissionMode: 'default',
    maxTokens: 16384,
    temperature: 1,
    extendedThinking: false,
    thinkingBudget: 10000,
    orgId,
  }
}

// ─── Agent Form Component ───────────────────────────────
function AgentForm({
  initialData,
  onSubmit,
  onCancel,
  isSaving,
}: {
  initialData: CreateAgentInput
  onSubmit: (data: CreateAgentInput) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<CreateAgentInput>(initialData)

  const handleChange = (field: keyof CreateAgentInput, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name & Icon row */}
      <div className="grid grid-cols-[1fr_80px_80px] gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="e.g. Code Reviewer"
            required
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Icon</label>
          <input
            type="text"
            value={form.icon || ''}
            onChange={e => handleChange('icon', e.target.value)}
            placeholder="🤖"
            maxLength={4}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-center text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Color</label>
          <input
            type="color"
            value={form.color || '#7c3aed'}
            onChange={e => handleChange('color', e.target.value)}
            className="h-[38px] w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--background)] px-1"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <input
          type="text"
          value={form.description || ''}
          onChange={e => handleChange('description', e.target.value)}
          placeholder="What does this agent do?"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>

      {/* Role & Model */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Role</label>
          <select
            value={form.role || 'general'}
            onChange={e => handleChange('role', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          >
            {AGENT_ROLES.map(role => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Model</label>
          <select
            value={form.model || DEFAULT_MODEL}
            onChange={e => handleChange('model', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.tier})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Permission Mode */}
      <div>
        <label className="mb-1 block text-sm font-medium">Permission Mode</label>
        <select
          value={form.permissionMode || 'default'}
          onChange={e => handleChange('permissionMode', e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
        >
          {PERMISSION_MODES.map(mode => (
            <option key={mode} value={mode}>
              {mode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* System Prompt */}
      <div>
        <label className="mb-1 block text-sm font-medium">System Prompt</label>
        <textarea
          value={form.systemPrompt || ''}
          onChange={e => handleChange('systemPrompt', e.target.value)}
          placeholder="Custom instructions for this agent..."
          rows={4}
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>

      {/* Temperature & Max Tokens */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Temperature: {form.temperature ?? 1}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={form.temperature ?? 1}
            onChange={e => handleChange('temperature', parseFloat(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
          <div className="mt-0.5 flex justify-between text-xs text-[var(--muted-foreground)]">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Max Tokens</label>
          <input
            type="number"
            value={form.maxTokens ?? 16384}
            onChange={e => handleChange('maxTokens', parseInt(e.target.value) || 0)}
            min={1}
            max={200000}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
      </div>

      {/* Extended Thinking */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
        <div>
          <p className="text-sm font-medium">Extended Thinking</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Allow the agent to think deeper before responding
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.extendedThinking}
          onClick={() => handleChange('extendedThinking', !form.extendedThinking)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            form.extendedThinking ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              form.extendedThinking ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Thinking Budget */}
      {form.extendedThinking && (
        <div>
          <label className="mb-1 block text-sm font-medium">Thinking Budget (tokens)</label>
          <input
            type="number"
            value={form.thinkingBudget ?? 10000}
            onChange={e => handleChange('thinkingBudget', parseInt(e.target.value) || 0)}
            min={1000}
            max={100000}
            step={1000}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !form.name.trim()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Agent'}
        </button>
      </div>
    </form>
  )
}

// ─── Delete Confirmation Dialog ─────────────────────────
function DeleteDialog({
  agent,
  onConfirm,
  onCancel,
}: {
  agent: AgentProfile
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">Delete Agent</h3>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Are you sure you want to delete <strong>{agent.name}</strong>? This action cannot be
          undone. The agent has completed {agent.totalTasksCompleted} tasks.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Delete Agent
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Agent Card ─────────────────────────────────────────
function AgentCard({
  agent,
  onEdit,
  onDelete,
}: {
  agent: AgentProfile
  onEdit: () => void
  onDelete: () => void
}) {
  const roleStyle = ROLE_COLORS[agent.role] || ROLE_COLORS.general
  const modelTier = getModelTier(agent.model)

  return (
    <div className="group relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-all hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/5">
      {/* Card header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-lg text-xl"
            style={{ backgroundColor: (agent.color || '#7c3aed') + '20' }}
          >
            {agent.icon || agent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{agent.name}</h3>
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}
            >
              {agent.role}
            </span>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            agent.isActive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
          }`}
        >
          {agent.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="mb-3 line-clamp-2 text-sm text-[var(--muted-foreground)]">
          {agent.description}
        </p>
      )}

      {/* Tags */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded bg-[var(--secondary)] px-2 py-0.5 text-xs font-medium ${
            MODEL_TIER_COLORS[modelTier] || 'text-[var(--muted-foreground)]'
          }`}
        >
          {getModelName(agent.model)}
        </span>
        <span className="rounded bg-[var(--secondary)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
          {agent.permissionMode.replace(/_/g, ' ')}
        </span>
        {agent.extendedThinking && (
          <span className="rounded bg-violet-500/15 px-2 py-0.5 text-xs text-violet-400">
            thinking
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
        <div className="flex gap-4">
          <span>{agent.totalTasksCompleted} tasks</span>
        </div>
        <span>{formatDate(agent.updatedAt)}</span>
      </div>

      {/* Hover action buttons */}
      <div className="absolute right-3 top-12 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onEdit}
          title="Edit agent"
          className="rounded-md bg-[var(--secondary)] p-1.5 transition-colors hover:bg-[var(--accent)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          title="Delete agent"
          className="rounded-md bg-[var(--secondary)] p-1.5 text-red-400 transition-colors hover:bg-red-500/15"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>

      {/* Clickable card area */}
      <button
        onClick={onEdit}
        className="absolute inset-0 rounded-xl"
        aria-label={`Edit ${agent.name}`}
      />
    </div>
  )
}

// ─── Project Agents Page ────────────────────────────────
export default function ProjectAgentsPage() {
  const params = useParams()
  const projectId = params.id as string
  const project = useProjectStore((s) => s.currentProject)
  const { agents, fetchAgents, createAgent, updateAgent, deleteAgent, isLoading, isSaving } =
    useAgentStore()

  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null)
  const [deletingAgent, setDeletingAgent] = useState<AgentProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  // Filter agents belonging to this project's org
  const projectAgents = agents.filter(
    (a: AgentProfile) => a.orgId === project?.orgId
  )

  const handleCreate = useCallback(
    async (data: CreateAgentInput) => {
      try {
        setError(null)
        await createAgent({ ...data, orgId: project?.orgId })
        setShowForm(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create agent')
      }
    },
    [createAgent, project?.orgId]
  )

  const handleUpdate = useCallback(
    async (data: CreateAgentInput) => {
      if (!editingAgent) return
      try {
        setError(null)
        await updateAgent(editingAgent.id, data)
        setEditingAgent(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update agent')
      }
    },
    [editingAgent, updateAgent]
  )

  const handleDelete = useCallback(async () => {
    if (!deletingAgent) return
    try {
      setError(null)
      await deleteAgent(deletingAgent.id)
      setDeletingAgent(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent')
    }
  }, [deletingAgent, deleteAgent])

  const agentToFormData = (agent: AgentProfile): CreateAgentInput => ({
    name: agent.name,
    description: agent.description,
    icon: agent.icon,
    color: agent.color,
    role: agent.role,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    permissionMode: agent.permissionMode,
    maxTokens: agent.maxTokens,
    temperature: agent.temperature,
    extendedThinking: agent.extendedThinking,
    thinkingBudget: agent.thinkingBudget,
    orgId: agent.orgId,
  })

  const isFormOpen = showForm || editingAgent !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Agents</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage AI agents for this project
          </p>
        </div>
        <button
          onClick={() => {
            setEditingAgent(null)
            setShowForm(true)
            setError(null)
          }}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          New Agent
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-medium underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Form modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-10 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">
              {editingAgent ? 'Edit Agent' : 'Create New Agent'}
            </h2>
            <AgentForm
              initialData={
                editingAgent
                  ? agentToFormData(editingAgent)
                  : getDefaultForm(project?.orgId)
              }
              onSubmit={editingAgent ? handleUpdate : handleCreate}
              onCancel={() => {
                setShowForm(false)
                setEditingAgent(null)
                setError(null)
              }}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingAgent && (
        <DeleteDialog
          agent={deletingAgent}
          onConfirm={handleDelete}
          onCancel={() => setDeletingAgent(null)}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading agents...</div>
      ) : projectAgents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
          <div className="mx-auto mb-3 text-4xl">🤖</div>
          <h3 className="text-lg font-medium">No agents configured</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Create an agent to automate tasks in this project
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Create Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => {
                setEditingAgent(agent)
                setShowForm(false)
                setError(null)
              }}
              onDelete={() => setDeletingAgent(agent)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
