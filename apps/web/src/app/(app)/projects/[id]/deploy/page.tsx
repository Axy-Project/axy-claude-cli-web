'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { DeployPipeline, DeployRun, WebhookType } from '@axy/shared'

const EMPTY_PIPELINE = {
  name: '', branchPattern: '', sftpHost: '', sftpPort: 22, sftpUsername: '',
  sftpPassword: '', sftpPrivateKey: '', sftpRemotePath: '', sftpSourcePath: '.',
  preDeployCommand: '', webhookUrl: '', webhookType: 'custom' as WebhookType,
}

export default function ProjectDeployPage() {
  const params = useParams()
  const projectId = params.id as string

  const [pipelines, setPipelines] = useState<DeployPipeline[]>([])
  const [runs, setRuns] = useState<DeployRun[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_PIPELINE)
  const [isSaving, setIsSaving] = useState(false)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api.get<DeployPipeline[]>(`/api/deploy/projects/${projectId}/pipelines`),
        api.get<DeployRun[]>(`/api/deploy/projects/${projectId}/runs?limit=20`),
      ])
      setPipelines(Array.isArray(p) ? p : [])
      setRuns(Array.isArray(r) ? r : [])
    } catch { /* empty */ }
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    if (!form.name || !form.branchPattern || !form.sftpHost || !form.sftpUsername || !form.sftpRemotePath) return
    if (!form.sftpPassword && !form.sftpPrivateKey && !editId) return
    setIsSaving(true)
    try {
      if (editId) {
        await api.put(`/api/deploy/pipelines/${editId}`, form)
      } else {
        await api.post(`/api/deploy/projects/${projectId}/pipelines`, form)
      }
      setShowForm(false)
      setEditId(null)
      setForm(EMPTY_PIPELINE)
      await loadData()
    } catch (err) { console.error(err) }
    finally { setIsSaving(false) }
  }

  const handleEdit = (p: DeployPipeline) => {
    setEditId(p.id)
    setForm({
      name: p.name, branchPattern: p.branchPattern, sftpHost: p.sftpHost,
      sftpPort: p.sftpPort, sftpUsername: p.sftpUsername, sftpPassword: '', sftpPrivateKey: '',
      sftpRemotePath: p.sftpRemotePath, sftpSourcePath: p.sftpSourcePath,
      preDeployCommand: p.preDeployCommand || '', webhookUrl: p.webhookUrl || '',
      webhookType: p.webhookType,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pipeline?')) return
    await api.delete(`/api/deploy/pipelines/${id}`)
    await loadData()
  }

  const handleTrigger = async (id: string) => {
    setTriggeringId(id)
    try {
      await api.post(`/api/deploy/pipelines/${id}/trigger`, {})
      setTimeout(loadData, 3000)
    } catch (err) { console.error(err) }
    finally { setTriggeringId(null) }
  }

  const inp = "w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Deploy</h2>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            Auto-deploy via SFTP when pushing to specific branches
          </p>
        </div>
        <button type="button" onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPTY_PIPELINE) }}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          {showForm ? 'Cancel' : '+ New Pipeline'}
        </button>
      </div>

      {/* Pipeline Form */}
      {showForm && (
        <div className="space-y-4 rounded-xl border border-[var(--primary)]/20 bg-[var(--card)] p-5">
          <h3 className="text-sm font-semibold">{editId ? 'Edit Pipeline' : 'New Pipeline'}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Pipeline Name *</label>
              <input type="text" placeholder="Deploy Staging" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Branch Trigger *</label>
              <input type="text" placeholder="staging, main, release/*" value={form.branchPattern}
                onChange={(e) => setForm({ ...form, branchPattern: e.target.value })} className={inp} />
            </div>
          </div>

          {/* SFTP */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">SFTP Server</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Host *</label>
                <input type="text" placeholder="server.example.com" value={form.sftpHost}
                  onChange={(e) => setForm({ ...form, sftpHost: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Port</label>
                <input type="number" value={form.sftpPort}
                  onChange={(e) => setForm({ ...form, sftpPort: parseInt(e.target.value) || 22 })} className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Username *</label>
                <input type="text" placeholder="deploy" value={form.sftpUsername}
                  onChange={(e) => setForm({ ...form, sftpUsername: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Password</label>
                <input type="password" placeholder={editId ? '(unchanged)' : 'password'} value={form.sftpPassword}
                  onChange={(e) => setForm({ ...form, sftpPassword: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Remote Path *</label>
                <input type="text" placeholder="/var/www/html" value={form.sftpRemotePath}
                  onChange={(e) => setForm({ ...form, sftpRemotePath: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Source Path</label>
                <input type="text" placeholder=". (project root)" value={form.sftpSourcePath}
                  onChange={(e) => setForm({ ...form, sftpSourcePath: e.target.value })} className={inp} />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Pre-deploy Command</label>
            <input type="text" placeholder="npm run build (optional)" value={form.preDeployCommand}
              onChange={(e) => setForm({ ...form, preDeployCommand: e.target.value })} className={inp} />
          </div>

          {/* Webhook */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Webhook Notification</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Webhook URL</label>
                <input type="url" placeholder="https://discord.com/api/webhooks/..." value={form.webhookUrl}
                  onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Type</label>
                <select value={form.webhookType}
                  onChange={(e) => setForm({ ...form, webhookType: e.target.value as WebhookType })} className={inp}>
                  <option value="discord">Discord</option>
                  <option value="slack">Slack</option>
                  <option value="custom">Custom (JSON)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={handleSave}
              disabled={isSaving || !form.name || !form.branchPattern || !form.sftpHost || !form.sftpUsername || !form.sftpRemotePath || (!form.sftpPassword && !form.sftpPrivateKey && !editId)}
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {isSaving ? 'Saving...' : editId ? 'Update Pipeline' : 'Create Pipeline'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_PIPELINE) }}
              className="rounded-lg border border-[var(--border)] px-5 py-2 text-sm font-medium hover:bg-[var(--secondary)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pipelines List */}
      {pipelines.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] py-12">
          <svg className="mb-3 h-10 w-10 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm font-medium">No deploy pipelines</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Create a pipeline to auto-deploy when pushing to a branch</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <div key={p.id} className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]/30">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${p.isEnabled ? 'bg-green-400' : 'bg-gray-400'}`} />
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-[var(--primary)]">
                      {p.branchPattern}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span className="font-mono">{p.sftpUsername}@{p.sftpHost}:{p.sftpPort}</span>
                    <span>{p.sftpRemotePath}</span>
                    {p.webhookUrl && (
                      <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] font-medium">
                        {p.webhookType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => handleTrigger(p.id)} disabled={triggeringId === p.id}
                    className="rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50">
                    {triggeringId === p.id ? 'Deploying...' : 'Deploy Now'}
                  </button>
                  <button type="button" onClick={() => handleEdit(p)}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]">
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(p.id)}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deploy History */}
      {runs.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Deploy History</h3>
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                  run.status === 'success' ? 'bg-green-400' :
                  run.status === 'failed' ? 'bg-red-400' :
                  run.status === 'running' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{run.pipelineName || 'Pipeline'}</span>
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">{run.branch}</span>
                    {run.commitHash && (
                      <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[10px]">{run.commitHash}</span>
                    )}
                  </div>
                  {run.error && (
                    <p className="mt-0.5 truncate text-xs text-red-400">{run.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                  {run.filesUploaded > 0 && <span>{run.filesUploaded} files</span>}
                  {run.durationMs && <span>{(run.durationMs / 1000).toFixed(1)}s</span>}
                  <span className={`font-medium ${
                    run.status === 'success' ? 'text-green-400' :
                    run.status === 'failed' ? 'text-red-400' :
                    run.status === 'running' ? 'text-yellow-400' : ''
                  }`}>
                    {run.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
