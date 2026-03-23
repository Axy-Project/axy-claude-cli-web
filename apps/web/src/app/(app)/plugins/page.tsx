'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'

interface PluginHooks {
  onMessage?: string
  onSessionStart?: string
  onSessionEnd?: string
  onProjectCreate?: string
  onDeploy?: string
}

interface Plugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  hooks: PluginHooks
  settings: Record<string, { type: string; label: string; default?: unknown }>
  enabled: boolean
  createdAt: string
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', version: '1.0.0', author: '' })
  const [isCreating, setIsCreating] = useState(false)

  const load = useCallback(() => {
    api.get<Plugin[]>('/api/plugins').then(setPlugins).catch(() => {}).finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setIsCreating(true)
    try {
      await api.post('/api/plugins', form)
      setForm({ name: '', description: '', version: '1.0.0', author: '' })
      setShowCreate(false)
      load()
    } catch { /* ignore */ }
    finally { setIsCreating(false) }
  }

  const handleToggle = async (id: string) => {
    await api.patch(`/api/plugins/${id}/toggle`, {})
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plugin?')) return
    await api.delete(`/api/plugins/${id}`)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plugins</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Extend Axy with custom plugins that hook into events.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDocs(!showDocs)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]">
            {showDocs ? 'Hide Docs' : 'Documentation'}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            New Plugin
          </button>
        </div>
      </div>

      {/* Documentation */}
      {showDocs && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-bold">Plugin Documentation</h2>
          <div className="mt-4 space-y-4 text-sm text-[var(--muted-foreground)]">
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">Plugin Structure</h3>
              <p className="mt-1">Each plugin is a JSON manifest that defines hooks, settings, and metadata.</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--background)] p-3 text-xs">
{`{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "What it does",
  "version": "1.0.0",
  "author": "Your Name",
  "hooks": {
    "onMessage": "curl -X POST https://api.example.com/hook",
    "onSessionStart": "echo 'Session started'",
    "onSessionEnd": null,
    "onProjectCreate": null,
    "onDeploy": "notify-team.sh"
  },
  "settings": {
    "apiKey": { "type": "string", "label": "API Key" },
    "verbose": { "type": "boolean", "label": "Verbose logging", "default": false }
  },
  "enabled": true
}`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">Available Hooks</h3>
              <ul className="mt-1 list-inside list-disc space-y-1">
                <li><code className="rounded bg-[var(--background)] px-1 text-xs">onMessage</code> — Triggered when a chat message is sent</li>
                <li><code className="rounded bg-[var(--background)] px-1 text-xs">onSessionStart</code> — When a new chat session begins</li>
                <li><code className="rounded bg-[var(--background)] px-1 text-xs">onSessionEnd</code> — When a chat session completes</li>
                <li><code className="rounded bg-[var(--background)] px-1 text-xs">onProjectCreate</code> — When a new project is created</li>
                <li><code className="rounded bg-[var(--background)] px-1 text-xs">onDeploy</code> — When a deployment pipeline runs</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">API Endpoints</h3>
              <ul className="mt-1 list-inside list-disc space-y-1 font-mono text-xs">
                <li>GET /api/plugins — List all plugins</li>
                <li>POST /api/plugins — Create plugin</li>
                <li>PUT /api/plugins/:id — Update plugin</li>
                <li>DELETE /api/plugins/:id — Delete plugin</li>
                <li>PATCH /api/plugins/:id/toggle — Enable/disable</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-medium">Create Plugin</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Plugin Name" className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" />
            <input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Author" className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" />
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="col-span-2 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} disabled={isCreating || !form.name.trim()} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {isCreating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Plugin list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" /></div>
      ) : plugins.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center">
          <h3 className="font-medium">No plugins installed</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create a plugin to extend Axy with custom hooks and functionality.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plugins.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{p.name}</h3>
                  <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[10px]">v{p.version}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.enabled ? 'bg-green-500/15 text-green-400' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}>
                    {p.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{p.description}</p>
                {p.hooks && Object.keys(p.hooks).filter((k) => (p.hooks as any)[k]).length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {Object.entries(p.hooks).filter(([, v]) => v).map(([k]) => (
                      <span key={k} className="rounded bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">{k}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(p.id)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--accent)]">
                  {p.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleDelete(p.id)} className="rounded-lg px-3 py-1.5 text-xs text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
