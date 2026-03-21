'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProjectStore } from '@/stores/project.store'
import { useAccountStore } from '@/stores/account.store'
import { api } from '@/lib/api-client'
import type { PermissionMode } from '@axy/shared'

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const project = useProjectStore((s) => s.currentProject)
  const updateProject = useProjectStore((s) => s.updateProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const importFileRef = useRef<HTMLInputElement>(null)
  const { accounts, fetchAccounts } = useAccountStore()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    githubRepoUrl: '',
    permissionMode: 'default' as PermissionMode,
    githubAccountId: '' as string,
    claudeAccountId: '' as string,
    autoPushToGithub: false,
    autoDeployOnChange: false,
  })

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description || '',
        githubRepoUrl: project.githubRepoUrl || '',
        permissionMode: project.permissionMode,
        githubAccountId: project.githubAccountId || '',
        claudeAccountId: project.claudeAccountId || '',
        autoPushToGithub: project.autoPushToGithub ?? false,
        autoDeployOnChange: project.autoDeployOnChange ?? false,
      })
    }
  }, [project])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return

    setIsSubmitting(true)
    try {
      await updateProject(projectId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        githubRepoUrl: form.githubRepoUrl.trim(),
        permissionMode: form.permissionMode,
        githubAccountId: form.githubAccountId || null,
        claudeAccountId: form.claudeAccountId || null,
        autoPushToGithub: form.autoPushToGithub,
        autoDeployOnChange: form.autoDeployOnChange,
      } as any)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (err) {
      console.error('Update project error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }
    await deleteProject(projectId)
    router.push('/projects')
  }

  const handleExportConfig = useCallback(async () => {
    setIsExporting(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3456`
      const token = localStorage.getItem('axy_token') || ''
      const res = await fetch(`${API_URL}/api/projects/${projectId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')

      const text = await res.text()
      const blob = new Blob([text], { type: 'application/json' })
      const filename = `${(project?.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '_')}_config.json`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setIsExporting(false)
    }
  }, [projectId, project?.name])

  const handleImportConfig = useCallback(async (file: File) => {
    setIsImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      // The export wraps in { success, data } - unwrap if needed
      const importData = json.data || json
      const result = await api.post<{ agents: number; skills: number; mcpServers: number }>(
        `/api/projects/${projectId}/import-config`,
        importData
      )
      setImportResult(
        `Imported ${result.agents} agent(s), ${result.skills} skill(s), ${result.mcpServers} MCP server(s)`
      )
      setTimeout(() => setImportResult(null), 5000)
    } catch (err) {
      console.error('Import error:', err)
      setImportResult('Import failed. Please check the JSON file format.')
      setTimeout(() => setImportResult(null), 5000)
    } finally {
      setIsImporting(false)
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }, [projectId])

  if (!project) {
    return <div className="animate-pulse text-[var(--muted-foreground)]">Loading settings...</div>
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h2 className="text-lg font-semibold">Project Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Project Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">GitHub Repository URL</label>
          <input
            type="url"
            value={form.githubRepoUrl}
            onChange={(e) => setForm({ ...form, githubRepoUrl: e.target.value })}
            placeholder="https://github.com/user/repo"
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Permission Mode</label>
          <select
            value={form.permissionMode}
            onChange={(e) => setForm({ ...form, permissionMode: e.target.value as PermissionMode })}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="default">Default (ask for permissions)</option>
            <option value="accept_edits">Accept Edits (auto-approve file changes)</option>
            <option value="plan">Plan Only (read-only mode)</option>
            <option value="bypass">Bypass Permissions (dangerous)</option>
          </select>
          {form.permissionMode === 'bypass' && (
            <p className="mt-1 text-xs text-[var(--destructive)]">
              Warning: Claude will execute any operation without asking for permission.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">GitHub Account</label>
          <select
            value={form.githubAccountId}
            onChange={(e) => setForm({ ...form, githubAccountId: e.target.value })}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="">Default (user default account)</option>
            {accounts.filter((a) => a.type === 'github').map((a) => (
              <option key={a.id} value={a.id}>
                {a.nickname}{a.username ? ` (@${a.username})` : ''}{a.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Select which GitHub account to use for this project. Manage accounts in Settings.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Claude API Key</label>
          <select
            value={form.claudeAccountId}
            onChange={(e) => setForm({ ...form, claudeAccountId: e.target.value })}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="">Default (user default or server key)</option>
            {accounts.filter((a) => a.type === 'claude_api_key').map((a) => (
              <option key={a.id} value={a.id}>
                {a.nickname}{a.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Select which API key Claude uses for this project. Manage keys in Settings.
          </p>
        </div>

        {/* Auto-actions */}
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)]/50 p-4">
          <h3 className="text-sm font-medium">Automation</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoPushToGithub}
              onChange={(e) => setForm({ ...form, autoPushToGithub: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <div>
              <span className="text-sm font-medium">Auto-push to GitHub</span>
              <p className="text-xs text-[var(--muted-foreground)]">Automatically push commits to GitHub after each Claude response.</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoDeployOnChange}
              onChange={(e) => setForm({ ...form, autoDeployOnChange: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <div>
              <span className="text-sm font-medium">Auto-deploy on change</span>
              <p className="text-xs text-[var(--muted-foreground)]">Automatically trigger deploy pipelines after each Claude response.</p>
            </div>
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !form.name.trim()}
            className="rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isSaved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Export / Import Config */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <h3 className="font-medium">Project Configuration</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Export or import project config (agents, skills, MCP servers, settings) as JSON.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportConfig}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isExporting ? 'Exporting...' : 'Export Config'}
          </button>
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {isImporting ? 'Importing...' : 'Import Config'}
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportConfig(file)
            }}
          />
        </div>
        {importResult && (
          <p className={`mt-2 text-sm ${importResult.startsWith('Import failed') ? 'text-[var(--destructive)]' : 'text-green-500'}`}>
            {importResult}
          </p>
        )}
      </div>

      {/* Full Backup Export */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <h3 className="font-medium">Full Backup</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Download a complete backup of this project including all files, chat sessions, messages, tasks, and notes. Use this to transfer the project to another Axy server.
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={async () => {
              try {
                const apiUrl = typeof window !== 'undefined'
                  ? (window.location.port === '' || window.location.port === '80' || window.location.port === '443')
                    ? `${window.location.protocol}//${window.location.hostname}`
                    : `${window.location.protocol}//${window.location.hostname}:3456`
                  : ''
                const token = localStorage.getItem('axy_token')
                const res = await fetch(`${apiUrl}/api/projects/${projectId}/export-backup`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                if (!res.ok) throw new Error('Export failed')
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${project?.name || 'project'}-backup.zip`
                a.click()
                URL.revokeObjectURL(url)
              } catch (err) {
                console.error('Backup export error:', err)
              }
            }}
            className="flex items-center gap-2 rounded-[0.375rem] px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dim))' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Download Full Backup (.zip)
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-[var(--destructive)] p-4">
        <h3 className="font-medium text-[var(--destructive)]">Danger Zone</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Permanently delete this project and all its data.
        </p>
        <button
          onClick={handleDelete}
          className="mt-3 rounded-lg border border-[var(--destructive)] px-4 py-2 text-sm font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)] hover:text-white"
        >
          Delete Project
        </button>
      </div>
    </div>
  )
}

