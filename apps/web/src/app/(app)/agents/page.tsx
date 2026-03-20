'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAgentStore } from '@/stores/agent.store'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { AGENT_ROLES, PERMISSION_MODES, MODELS, DEFAULT_MODEL } from '@axy/shared'
import type { AgentProfile, CreateAgentInput, AgentRole } from '@axy/shared'

// ── Terminal Curator role badge colors ──────────────────
const ROLE_COLORS: Record<AgentRole, string> = {
  orchestrator: '#3bfb8c',
  researcher: '#bd9dff',
  coder: '#bd9dff',
  tester: '#ffb74d',
  reviewer: '#ffa5d9',
  general: '#767575',
}

function getRoleColor(role: AgentRole): string {
  return ROLE_COLORS[role] || ROLE_COLORS.general
}

function getModelName(modelId: string): string {
  const model = MODELS.find(m => m.id === modelId)
  return model?.name ?? modelId
}

function getModelTier(modelId: string): string {
  const model = MODELS.find(m => m.id === modelId)
  return model?.tier ?? 'standard'
}

// ── Default form values ────────────────────────────────
const DEFAULT_FORM: CreateAgentInput = {
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
}

// ── Form input classes (Terminal Curator) ───────────────
const inputClass =
  'w-full rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] bg-[#0e0e0e] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[#767575] focus:border-[#bd9dff] focus:ring-1 focus:ring-[#bd9dff]'

const selectClass = inputClass

const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wider text-[#767575]'

// ── Agent Form Component ───────────────────────────────
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
  const [showAdvanced, setShowAdvanced] = useState(false)

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
          <label className={labelClass}>Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="e.g. Code Reviewer"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Icon</label>
          <input
            type="text"
            value={form.icon || ''}
            onChange={e => handleChange('icon', e.target.value)}
            placeholder=""
            maxLength={4}
            className={`${inputClass} text-center`}
          />
        </div>
        <div>
          <label className={labelClass}>Color</label>
          <input
            type="color"
            value={form.color || '#7c3aed'}
            onChange={e => handleChange('color', e.target.value)}
            className="h-[38px] w-full cursor-pointer rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] bg-[#0e0e0e] px-1"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <input
          type="text"
          value={form.description || ''}
          onChange={e => handleChange('description', e.target.value)}
          placeholder="What does this agent do?"
          className={inputClass}
        />
      </div>

      {/* Role & Model */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Role</label>
          <select
            value={form.role || 'general'}
            onChange={e => handleChange('role', e.target.value)}
            className={selectClass}
          >
            {AGENT_ROLES.map(role => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Model</label>
          <select
            value={form.model || DEFAULT_MODEL}
            onChange={e => handleChange('model', e.target.value)}
            className={selectClass}
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.tier})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <label className={labelClass}>System Prompt</label>
        <textarea
          value={form.systemPrompt || ''}
          onChange={e => handleChange('systemPrompt', e.target.value)}
          placeholder="Custom instructions for this agent..."
          rows={4}
          className={`${inputClass} resize-y font-mono`}
        />
      </div>

      {/* Advanced Settings Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(prev => !prev)}
        className="flex w-full items-center gap-2 rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] px-4 py-2.5 text-sm font-medium text-[#adaaaa] transition-colors hover:bg-[#1a1a1a]"
      >
        <svg
          className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Advanced Settings
      </button>

      {showAdvanced && (
        <div className="space-y-5 rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] bg-[#141414] p-4">
          {/* Permission Mode */}
          <div>
            <label className={labelClass}>Permission Mode</label>
            <select
              value={form.permissionMode || 'default'}
              onChange={e => handleChange('permissionMode', e.target.value)}
              className={selectClass}
            >
              {PERMISSION_MODES.map(mode => (
                <option key={mode} value={mode}>
                  {mode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Temperature & Max Tokens */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Temperature: {form.temperature ?? 1}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature ?? 1}
                onChange={e => handleChange('temperature', parseFloat(e.target.value))}
                className="w-full accent-[#bd9dff]"
              />
              <div className="mt-0.5 flex justify-between text-xs text-[#767575]">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Max Tokens</label>
              <input
                type="number"
                value={form.maxTokens ?? 16384}
                onChange={e => handleChange('maxTokens', parseInt(e.target.value) || 0)}
                min={1}
                max={200000}
                className={inputClass}
              />
            </div>
          </div>

          {/* Extended Thinking */}
          <div className="flex items-center justify-between rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] bg-[#1a1a1a] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Extended Thinking</p>
              <p className="text-xs text-[#767575]">
                Allow the agent to think deeper before responding
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.extendedThinking}
              onClick={() => handleChange('extendedThinking', !form.extendedThinking)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                form.extendedThinking ? 'bg-[#bd9dff]' : 'bg-[#333]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  form.extendedThinking ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Thinking Budget (shown only when extended thinking is on) */}
          {form.extendedThinking && (
            <div>
              <label className={labelClass}>Thinking Budget (tokens)</label>
              <input
                type="number"
                value={form.thinkingBudget ?? 10000}
                onChange={e => handleChange('thinkingBudget', parseInt(e.target.value) || 0)}
                min={1000}
                max={100000}
                step={1000}
                className={inputClass}
              />
            </div>
          )}

        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-[rgba(72,72,71,0.15)] pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] px-4 py-2 text-sm font-medium text-[#adaaaa] transition-colors hover:bg-[#1a1a1a]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !form.name.trim()}
          className="rounded-[0.5rem] bg-gradient-to-r from-[#bd9dff] to-[#9b6dff] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Agent'}
        </button>
      </div>
    </form>
  )
}

// ── Delete Confirmation Dialog ─────────────────────────
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
      <div className="mx-4 w-full max-w-md rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] p-6 shadow-2xl">
        <h3 className="font-headline text-lg font-bold text-white">Delete Agent</h3>
        <p className="mt-2 text-sm text-[#adaaaa]">
          Are you sure you want to delete <strong className="text-white">{agent.name}</strong>? This action cannot be
          undone. The agent has completed {agent.totalTasksCompleted} tasks.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] px-4 py-2 text-sm font-medium text-[#adaaaa] transition-colors hover:bg-[#222]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-[0.5rem] bg-[#ff6e84] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Delete Agent
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Three-dot menu for agent card ──────────────────────
function CardMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative z-20">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(o => !o)
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#767575] transition-colors hover:bg-[#222] hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 min-w-[140px] rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] bg-[#1a1a1a] py-1 shadow-xl">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onEdit()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#adaaaa] transition-colors hover:bg-[#222] hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onDelete()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#ff6e84] transition-colors hover:bg-[#ff6e84]/10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Agent Card (Terminal Curator) ──────────────────────
function AgentCard({
  agent,
  onEdit,
  onDelete,
}: {
  agent: AgentProfile
  onEdit: () => void
  onDelete: () => void
}) {
  const roleColor = getRoleColor(agent.role)
  const modelTier = getModelTier(agent.model)
  const usagePercent = Math.min(100, Math.round((agent.totalTasksCompleted / Math.max(agent.totalTasksCompleted, 50)) * 100))

  return (
    <div
      className="group relative flex flex-col rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] p-6 transition-all hover:border-[rgba(189,157,255,0.25)] hover:shadow-lg hover:shadow-[#bd9dff]/5"
    >
      {/* Top row: category badge + three-dot menu */}
      <div className="mb-4 flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            color: roleColor,
            backgroundColor: `${roleColor}15`,
            border: `1px solid ${roleColor}30`,
          }}
        >
          {agent.role}
        </span>
        <CardMenu onEdit={onEdit} onDelete={onDelete} />
      </div>

      {/* Agent name */}
      <h3 className="font-headline text-lg font-bold leading-tight text-white">
        {agent.icon ? `${agent.icon} ` : ''}{agent.name}
      </h3>

      {/* Description */}
      <p className="mt-2 line-clamp-3 min-h-[3.5rem] text-sm leading-relaxed text-[#adaaaa]">
        {agent.description || 'No description provided.'}
      </p>

      {/* Bottom info section */}
      <div className="mt-auto pt-5">
        {/* Model label + name */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#767575]">
              Model
            </span>
            <span className="text-xs font-medium text-[#bd9dff]">
              {getModelName(agent.model)}
            </span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              agent.isActive
                ? 'bg-[#3bfb8c]/10 text-[#3bfb8c]'
                : 'bg-[#ff6e84]/10 text-[#ff6e84]'
            }`}
          >
            {agent.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Usage bar */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#767575]">
              Usage
            </span>
            <span className="text-xs text-[#767575]">
              {agent.totalTasksCompleted} tasks
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#222]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#bd9dff] to-[#9b6dff] transition-all"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between border-t border-[rgba(72,72,71,0.15)] pt-3">
          <span className="text-xs text-[#767575]">{formatDate(agent.updatedAt)}</span>
          <div className="flex gap-2">
            {agent.extendedThinking && (
              <span className="rounded border border-[rgba(189,157,255,0.2)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#bd9dff]">
                Thinking
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="rounded-[0.375rem] border border-[rgba(72,72,71,0.3)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#adaaaa] transition-colors hover:border-[#bd9dff] hover:text-[#bd9dff]"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Clickable card area */}
      <button
        onClick={onEdit}
        className="absolute inset-0 z-10 rounded-[0.75rem]"
        aria-label={`Edit ${agent.name}`}
      />
    </div>
  )
}

// ── Main Agents Page ───────────────────────────────────
export default function AgentsPage() {
  const { agents, fetchAgents, createAgent, updateAgent, deleteAgent, isLoading, isSaving } =
    useAgentStore()

  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null)
  const [deletingAgent, setDeletingAgent] = useState<AgentProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const handleCreate = useCallback(
    async (data: CreateAgentInput) => {
      try {
        setError(null)
        await createAgent(data)
        setShowForm(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create agent')
      }
    },
    [createAgent]
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-headline text-4xl font-bold text-white">Agents</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#adaaaa]">
            Manage your fleet of specialized AI entities. Orchestrate multi-agent workflows with architectural precision.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Link
            href="/agents/templates"
            className="rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] px-4 py-2 text-sm font-medium text-[#adaaaa] transition-colors hover:border-[#bd9dff] hover:text-white"
          >
            Browse Templates
          </Link>
          <button
            onClick={() => {
              setEditingAgent(null)
              setShowForm(true)
              setError(null)
            }}
            className="rounded-[0.5rem] bg-gradient-to-r from-[#bd9dff] to-[#9b6dff] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            New Agent
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-[0.5rem] border border-[#ff6e84]/30 bg-[#ff6e84]/10 px-4 py-3 text-sm text-[#ff6e84]">
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
          <div className="mx-4 w-full max-w-2xl rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] p-6 shadow-2xl">
            <h2 className="font-headline mb-5 text-xl font-bold text-white">
              {editingAgent ? 'Edit Agent' : 'Create New Agent'}
            </h2>
            <AgentForm
              initialData={editingAgent ? agentToFormData(editingAgent) : DEFAULT_FORM}
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
        <div className="flex items-center gap-3 py-12 text-[#767575]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#bd9dff] border-t-transparent" />
          Loading agents...
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-[0.75rem] border border-dashed border-[rgba(72,72,71,0.3)] bg-[#1a1a1a] p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#bd9dff]/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bd9dff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
              <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
            </svg>
          </div>
          <h3 className="font-headline text-lg font-bold text-white">No agents yet</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[#adaaaa]">
            Create an agent profile or browse templates to get started with your AI workforce.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/agents/templates"
              className="rounded-[0.5rem] border border-[rgba(72,72,71,0.3)] px-4 py-2 text-sm font-medium text-[#adaaaa] transition-colors hover:border-[#bd9dff] hover:text-white"
            >
              Browse Templates
            </Link>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-[0.5rem] bg-gradient-to-r from-[#bd9dff] to-[#9b6dff] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Create Agent
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {agents.map((agent) => (
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
