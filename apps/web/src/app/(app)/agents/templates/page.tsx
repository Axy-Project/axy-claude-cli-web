'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAgentStore, type CatalogAgent } from '@/stores/agent.store'
import { MODELS } from '@axy/shared'
import Link from 'next/link'

// ─── Role badge colors ──────────────────────────────────
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  orchestrator: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  researcher: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  coder: { bg: 'bg-green-500/15', text: 'text-green-400' },
  tester: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  reviewer: { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  general: { bg: 'bg-slate-500/15', text: 'text-slate-400' },
}

const MODEL_TIER_COLORS: Record<string, string> = {
  ultra: 'text-fuchsia-400',
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

// ─── Prompt Preview Modal ───────────────────────────────
function PromptPreviewModal({
  agent,
  onClose,
  onImport,
  isImporting,
}: {
  agent: CatalogAgent
  onClose: () => void
  onImport: () => void
  isImporting: boolean
}) {
  const roleStyle = ROLE_COLORS[agent.role] || ROLE_COLORS.general
  const modelTier = getModelTier(agent.model)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-10 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="mx-4 w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border)] p-6">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold"
              style={{
                backgroundColor: agent.color + '20',
                color: agent.color,
              }}
            >
              {agent.icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{agent.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}
                >
                  {agent.role}
                </span>
                <span
                  className={`rounded bg-[var(--secondary)] px-1.5 py-0.5 text-xs font-medium ${MODEL_TIER_COLORS[modelTier] || 'text-[var(--muted-foreground)]'}`}
                >
                  {getModelName(agent.model)}
                </span>
                {agent.extendedThinking && (
                  <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-400">
                    extended thinking
                  </span>
                )}
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    agent.source === 'official'
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {agent.source}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="Close preview"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <p className="text-sm text-[var(--muted-foreground)]">{agent.description}</p>
        </div>

        {/* Configuration Details */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">Configuration</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Category:</span>
              <span>{agent.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Role:</span>
              <span className="capitalize">{agent.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Model:</span>
              <span>{getModelName(agent.model)}</span>
            </div>
            {agent.extendedThinking && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Thinking budget:</span>
                <span>{(agent.thinkingBudget ?? 10000).toLocaleString()} tokens</span>
              </div>
            )}
          </div>
        </div>

        {/* System Prompt */}
        <div className="px-6 py-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">System Prompt</h3>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--foreground)]">
              {agent.systemPrompt}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
          >
            Close
          </button>
          <button
            onClick={onImport}
            disabled={isImporting}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isImporting ? 'Importing...' : 'Import Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Catalog Card ───────────────────────────────────────
function CatalogCard({
  agent,
  onPreview,
  onImport,
  isImporting,
}: {
  agent: CatalogAgent
  onPreview: () => void
  onImport: () => void
  isImporting: boolean
}) {
  const roleStyle = ROLE_COLORS[agent.role] || ROLE_COLORS.general
  const modelTier = getModelTier(agent.model)

  return (
    <div className="group relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-all hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/5">
      {/* Card header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-lg text-xs font-bold"
            style={{
              backgroundColor: agent.color + '20',
              color: agent.color,
            }}
          >
            {agent.icon}
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
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            agent.source === 'official'
              ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
              : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
          }`}
        >
          {agent.source}
        </span>
      </div>

      {/* Description */}
      <p className="mb-3 line-clamp-2 text-sm text-[var(--muted-foreground)]">
        {agent.description}
      </p>

      {/* Tags */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-[var(--secondary)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
          {agent.category}
        </span>
        <span
          className={`rounded bg-[var(--secondary)] px-2 py-0.5 text-xs font-medium ${
            MODEL_TIER_COLORS[modelTier] || 'text-[var(--muted-foreground)]'
          }`}
        >
          {getModelName(agent.model)}
        </span>
        {agent.extendedThinking && (
          <span className="rounded bg-violet-500/15 px-2 py-0.5 text-xs text-violet-400">
            thinking
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex gap-2 border-t border-[var(--border)] pt-3">
        <button
          onClick={onPreview}
          className="flex-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
        >
          Preview
        </button>
        <button
          onClick={onImport}
          disabled={isImporting}
          className="flex-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isImporting ? 'Importing...' : 'Import'}
        </button>
      </div>
    </div>
  )
}

// ─── Success Toast ──────────────────────────────────────
function SuccessToast({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 shadow-lg backdrop-blur">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span><strong>{name}</strong> imported successfully</span>
      <button onClick={onDismiss} className="ml-2 text-green-400/60 hover:text-green-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ─── Main Templates Page ────────────────────────────────
export default function AgentTemplatesPage() {
  const {
    catalogAgents,
    catalogCategories,
    isCatalogLoading,
    isImporting,
    fetchCatalog,
    importAgent,
  } = useAgentStore()

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [previewAgent, setPreviewAgent] = useState<CatalogAgent | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  const filteredAgents = useMemo(() => {
    return catalogAgents.filter((agent) => {
      const matchesSearch =
        !search ||
        agent.name.toLowerCase().includes(search.toLowerCase()) ||
        agent.description.toLowerCase().includes(search.toLowerCase()) ||
        agent.role.toLowerCase().includes(search.toLowerCase())

      const matchesCategory =
        selectedCategory === 'all' || agent.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [catalogAgents, search, selectedCategory])

  const handleImport = useCallback(
    async (agent: CatalogAgent) => {
      try {
        setError(null)
        await importAgent(agent.id)
        setSuccessMessage(agent.name)
        setPreviewAgent(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import agent')
      }
    },
    [importAgent]
  )

  const officialCount = catalogAgents.filter(a => a.source === 'official').length
  const communityCount = catalogAgents.filter(a => a.source === 'community').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Catalog</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {catalogAgents.length} pre-configured agents
            {officialCount > 0 && ` -- ${officialCount} official, ${communityCount} community`}
          </p>
        </div>
        <Link
          href="/agents"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
        >
          My Agents
        </Link>
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

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search agents by name, description, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[var(--primary)] text-white'
                : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
            }`}
          >
            All
          </button>
          {catalogCategories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isCatalogLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card)]"
            />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <h3 className="text-lg font-medium">No agents found</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {search || selectedCategory !== 'all'
              ? 'Try adjusting your search or filter'
              : 'The catalog is empty'}
          </p>
          {(search || selectedCategory !== 'all') && (
            <button
              onClick={() => {
                setSearch('')
                setSelectedCategory('all')
              }}
              className="mt-3 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => (
            <CatalogCard
              key={agent.id}
              agent={agent}
              onPreview={() => setPreviewAgent(agent)}
              onImport={() => handleImport(agent)}
              isImporting={isImporting === agent.id}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewAgent && (
        <PromptPreviewModal
          agent={previewAgent}
          onClose={() => setPreviewAgent(null)}
          onImport={() => handleImport(previewAgent)}
          isImporting={isImporting === previewAgent.id}
        />
      )}

      {/* Success Toast */}
      {successMessage && (
        <SuccessToast
          name={successMessage}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}
    </div>
  )
}
