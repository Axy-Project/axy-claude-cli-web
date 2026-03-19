'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useMcpStore } from '@/stores/mcp.store'
import type { RegistryServer } from '@/stores/mcp.store'
import { api } from '@/lib/api-client'
import type { McpServer } from '@axy/shared'

const PRESETS = [
  {
    label: 'Filesystem',
    name: 'filesystem',
    command: 'npx',
    argsJson: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
  },
  {
    label: 'GitHub',
    name: 'github',
    command: 'npx',
    argsJson: ['-y', '@modelcontextprotocol/server-github'],
  },
  {
    label: 'Postgres',
    name: 'postgres',
    command: 'npx',
    argsJson: ['-y', '@modelcontextprotocol/server-postgres'],
  },
] as const

type Tab = 'servers' | 'registry'

interface FormState {
  name: string
  command: string
  argsText: string
  envText: string
  type: string
}

const EMPTY_FORM: FormState = {
  name: '',
  command: '',
  argsText: '',
  envText: '',
  type: 'stdio',
}

function parseArgs(text: string): string[] {
  if (!text.trim()) return []
  return text.split(',').map((a) => a.trim()).filter(Boolean)
}

function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
    }
  }
  return env
}

function envToText(env: Record<string, string>): string {
  return Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n')
}

// ─── Registry Browser Component ─────────────────────────

function RegistryBrowser({ projectId }: { projectId: string }) {
  const {
    registryServers,
    registryLoading,
    registryNextCursor,
    browseRegistry,
    loadMoreRegistry,
    importFromRegistry,
  } = useMcpStore()

  const [searchInput, setSearchInput] = useState('')
  const [importingName, setImportingName] = useState<string | null>(null)
  const [importedNames, setImportedNames] = useState<Set<string>>(new Set())
  const [initialLoaded, setInitialLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load registry on mount
  useEffect(() => {
    if (!initialLoaded) {
      browseRegistry()
      setInitialLoaded(true)
    }
  }, [browseRegistry, initialLoaded])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      browseRegistry(value || undefined)
    }, 400)
  }

  const handleImport = async (entry: RegistryServer) => {
    const name = entry.server.name
    setImportingName(name)
    try {
      await importFromRegistry(projectId, entry)
      setImportedNames((prev) => new Set(prev).add(name))
    } catch (err) {
      console.error('Failed to import MCP server:', err)
    } finally {
      setImportingName(null)
    }
  }

  const getMeta = (entry: RegistryServer) =>
    entry._meta?.['com.anthropic.api/mcp-registry']

  const getTransportLabel = (entry: RegistryServer) => {
    if (entry.server.remotes && entry.server.remotes.length > 0) {
      return entry.server.remotes[0].type === 'sse' ? 'SSE' : 'HTTP'
    }
    if (entry.server.packages && entry.server.packages.length > 0) {
      return entry.server.packages[0].registryType.toUpperCase()
    }
    return 'stdio'
  }

  const getEnvVarCount = (entry: RegistryServer) => {
    if (!entry.server.packages) return 0
    return entry.server.packages.reduce(
      (sum, pkg) => sum + (pkg.environmentVariables?.length || 0),
      0
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search MCP servers (e.g. notion, github, slack...)"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[var(--primary)]"
        />
      </div>

      {/* Results */}
      {registryLoading && registryServers.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-[var(--muted-foreground)]">Loading registry...</div>
        </div>
      ) : registryServers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
          <h3 className="text-lg font-medium">No servers found</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {searchInput
              ? `No results for "${searchInput}". Try a different search term.`
              : 'The registry appears to be empty or unavailable.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {registryServers.map((entry) => {
              const meta = getMeta(entry)
              const displayName = meta?.displayName || entry.server.title || entry.server.name
              const oneLiner = meta?.oneLiner || entry.server.description
              const toolCount = meta?.toolNames?.length || 0
              const transport = getTransportLabel(entry)
              const envVars = getEnvVarCount(entry)
              const isImporting = importingName === entry.server.name
              const isImported = importedNames.has(entry.server.name)

              return (
                <div
                  key={entry.server.name}
                  className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
                >
                  {/* Header */}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium" title={displayName}>
                        {displayName}
                      </h3>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {entry.server.name}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] text-[var(--foreground)]">
                      {transport}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mb-3 line-clamp-2 flex-1 text-sm text-[var(--muted-foreground)]">
                    {oneLiner || 'No description available'}
                  </p>

                  {/* Metadata badges */}
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {toolCount > 0 && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        {toolCount} tool{toolCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {envVars > 0 && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                        {envVars} env var{envVars !== 1 ? 's' : ''}
                      </span>
                    )}
                    {entry.server.version && (
                      <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                        v{entry.server.version}
                      </span>
                    )}
                    {meta?.worksWith && meta.worksWith.includes('claude-code') && (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                        Claude Code
                      </span>
                    )}
                  </div>

                  {/* Import button */}
                  <button
                    onClick={() => handleImport(entry)}
                    disabled={isImporting || isImported}
                    className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isImported
                        ? 'border border-green-500/30 bg-green-500/10 text-green-400'
                        : 'bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50'
                    }`}
                  >
                    {isImporting ? 'Adding...' : isImported ? 'Added to Project' : 'Add to Project'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Load More */}
          {registryNextCursor && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMoreRegistry}
                disabled={registryLoading}
                className="rounded-lg border border-[var(--border)] px-6 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {registryLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────

export default function ProjectMcpPage() {
  const params = useParams()
  const projectId = params.id as string
  const { servers, fetchServers, createServer, updateServer, deleteServer, toggleServer, isLoading } = useMcpStore()

  const [activeTab, setActiveTab] = useState<Tab>('servers')
  const [showForm, setShowForm] = useState(false)
  const [editingServer, setEditingServer] = useState<McpServer | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [configJson, setConfigJson] = useState<string>('')
  const [configLoading, setConfigLoading] = useState(false)

  useEffect(() => {
    fetchServers(projectId)
  }, [fetchServers, projectId])

  const loadConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const config = await api.get<Record<string, unknown>>(`/api/mcp/project/${projectId}/config`)
      setConfigJson(JSON.stringify(config, null, 2))
    } catch {
      setConfigJson('// Failed to load config')
    } finally {
      setConfigLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadConfig()
  }, [loadConfig, servers])

  const openCreate = useCallback(() => {
    setEditingServer(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }, [])

  const openPreset = useCallback((preset: typeof PRESETS[number]) => {
    setEditingServer(null)
    setForm({
      name: preset.name,
      command: preset.command,
      argsText: preset.argsJson.join(', '),
      envText: '',
      type: 'stdio',
    })
    setShowForm(true)
  }, [])

  const openEdit = useCallback((server: McpServer) => {
    setEditingServer(server)
    setForm({
      name: server.name,
      command: server.command,
      argsText: (server.argsJson || []).join(', '),
      envText: envToText(server.envJson || {}),
      type: server.type,
    })
    setShowForm(true)
  }, [])

  const closeForm = useCallback(() => {
    setShowForm(false)
    setEditingServer(null)
    setForm(EMPTY_FORM)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        projectId,
        name: form.name,
        command: form.command,
        argsJson: parseArgs(form.argsText),
        envJson: parseEnv(form.envText),
        type: form.type,
      }
      if (editingServer) {
        await updateServer(editingServer.id, payload)
      } else {
        await createServer(payload)
      }
      closeForm()
    } catch (err) {
      console.error('Failed to save MCP server:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this MCP server? This action cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteServer(id)
    } catch (err) {
      console.error('Failed to delete MCP server:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggle = async (server: McpServer) => {
    try {
      await toggleServer(server.id, !server.isEnabled)
    } catch (err) {
      console.error('Failed to toggle MCP server:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">MCP Servers</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage Model Context Protocol servers for this project
          </p>
        </div>
        {activeTab === 'servers' && (
          <button
            onClick={openCreate}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Add MCP Server
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] p-1">
        <button
          onClick={() => setActiveTab('servers')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'servers'
              ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          My Servers
          {servers.length > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px]">
              {servers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'registry'
              ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          Registry
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[5vh]">
          <div className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
              </h2>
              <button
                onClick={closeForm}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. filesystem"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                />
              </div>

              {/* Command & Type row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">Command</label>
                  <input
                    type="text"
                    required
                    value={form.command}
                    onChange={(e) => setForm({ ...form, command: e.target.value })}
                    placeholder="e.g. npx"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                  >
                    <option value="stdio">stdio</option>
                    <option value="sse">sse</option>
                  </select>
                </div>
              </div>

              {/* Args */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Arguments</label>
                <input
                  type="text"
                  value={form.argsText}
                  onChange={(e) => setForm({ ...form, argsText: e.target.value })}
                  placeholder="-y, @modelcontextprotocol/server-filesystem, /path"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                />
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Comma-separated list of arguments
                </p>
              </div>

              {/* Environment Variables */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Environment Variables
                </label>
                <textarea
                  rows={4}
                  value={form.envText}
                  onChange={(e) => setForm({ ...form, envText: e.target.value })}
                  placeholder={'GITHUB_TOKEN=ghp_xxx\nDATABASE_URL=postgres://...'}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-[var(--primary)]"
                />
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  One KEY=VALUE pair per line
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'servers' && (
        <>
          {/* Preset Quick-Add */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Quick Add
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => openPreset(preset)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium transition-colors hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Server List */}
          {isLoading ? (
            <div className="animate-pulse text-[var(--muted-foreground)]">Loading MCP servers...</div>
          ) : servers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
              <h3 className="text-lg font-medium">No MCP servers configured</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Add an MCP server or browse the registry to extend Claude with external tools
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={openCreate}
                  className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
                >
                  Add MCP Server
                </button>
                <button
                  onClick={() => setActiveTab('registry')}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
                >
                  Browse Registry
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="group rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Name + type badge */}
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{server.name}</h3>
                        <span className="rounded bg-[var(--accent)] px-2 py-0.5 font-mono text-xs text-[var(--foreground)]">
                          {server.type}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs ${
                          server.isEnabled
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-[var(--accent)] text-[var(--muted-foreground)]'
                        }`}>
                          {server.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      {/* Command line */}
                      <p className="mt-1.5 font-mono text-sm text-[var(--muted-foreground)]">
                        {server.command} {(server.argsJson || []).join(' ')}
                      </p>

                      {/* Env vars count */}
                      {server.envJson && Object.keys(server.envJson).length > 0 && (
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {Object.keys(server.envJson).length} environment variable{Object.keys(server.envJson).length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="ml-4 flex items-center gap-2">
                      {/* Toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={server.isEnabled}
                        onClick={() => handleToggle(server)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          server.isEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                            server.isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>

                      {/* Edit / Delete */}
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(server)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(server.id)}
                          disabled={deletingId === server.id}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {deletingId === server.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Generated CLI Config */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Generated CLI Config</h3>
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">
              This JSON configuration is passed to the Claude CLI for MCP server connections
            </p>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              {configLoading ? (
                <div className="animate-pulse text-sm text-[var(--muted-foreground)]">Loading config...</div>
              ) : (
                <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-[var(--muted-foreground)]">
                  <code>{configJson}</code>
                </pre>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'registry' && (
        <RegistryBrowser projectId={projectId} />
      )}
    </div>
  )
}
