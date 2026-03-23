'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProjectStore } from '@/stores/project.store'
import { useAccountStore } from '@/stores/account.store'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/lib/api-client'
import type { PermissionMode, Organization, ProjectRole } from '@axy/shared'

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const project = useProjectStore((s) => s.currentProject)
  const updateProject = useProjectStore((s) => s.updateProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const importFileRef = useRef<HTMLInputElement>(null)
  const { accounts, fetchAccounts } = useAccountStore()

  const moveProject = useProjectStore((s) => s.moveProject)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [isMoving, setIsMoving] = useState(false)
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
    api.get<Organization[]>('/api/orgs').then(setOrgs).catch(() => {})
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
    if (!deletePassword) { setDeleteError('Enter your password'); return }
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteProject(projectId, deletePassword)
      router.push('/projects')
    } catch (err) {
      setDeleteError((err as Error).message || 'Failed to delete')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMove = async (orgId: string | null) => {
    setIsMoving(true)
    try {
      await moveProject(projectId, orgId)
    } catch (err) {
      console.error('Move failed:', err)
    } finally {
      setIsMoving(false)
    }
  }

  const handleExportConfig = useCallback(async () => {
    setIsExporting(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ((window.location.port === '' || window.location.port === '80' || window.location.port === '443') ? `${window.location.protocol}//${window.location.hostname}` : `${window.location.protocol}//${window.location.hostname}:3456`)
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

      {/* Project Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {project.avatarUrl ? (
            <img src={project.avatarUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--primary)]/20 text-2xl font-bold text-[var(--primary)]">
              {project.name[0]?.toUpperCase()}
            </div>
          )}
          <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[var(--primary)] text-white shadow hover:opacity-90">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const formData = new FormData()
              formData.append('avatar', file)
              const token = localStorage.getItem('axy_token')
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || ((window.location.port === '' || window.location.port === '80' || window.location.port === '443') ? `${window.location.protocol}//${window.location.hostname}` : `${window.location.protocol}//${window.location.hostname}:3456`)
              const res = await fetch(`${apiUrl}/api/projects/${projectId}/avatar`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
              })
              if (res.ok) window.location.reload()
            }} />
          </label>
        </div>
        <div>
          <h3 className="font-medium">{project.name}</h3>
          <p className="text-xs text-[var(--muted-foreground)]">Click the + to upload a project logo</p>
        </div>
      </div>

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

      {/* Project Members */}
      <ProjectMembersSection projectId={projectId} isOwner={project?.userId === useAuthStore.getState().user?.id} />

      {/* Move to Organization */}
      {orgs.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-medium">Organization</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Move this project to an organization or back to personal.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <select
              value={project?.orgId || ''}
              onChange={(e) => handleMove(e.target.value || null)}
              disabled={isMoving}
              className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none disabled:opacity-50"
            >
              <option value="">Personal</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            {isMoving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-lg border border-[var(--destructive)] p-4">
        <h3 className="font-medium text-[var(--destructive)]">Danger Zone</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Permanently delete this project and all its data. Only the project creator can delete it.
        </p>
        {!showDeleteDialog ? (
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="mt-3 rounded-lg border border-[var(--destructive)] px-4 py-2 text-sm font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)] hover:text-white"
          >
            Delete Project
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-3">
            <p className="text-sm font-medium text-[var(--destructive)]">
              Enter your password to confirm deletion of &quot;{project?.name}&quot;
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your password"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--destructive)]"
            />
            {deleteError && (
              <p className="text-xs text-[var(--destructive)]">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting || !deletePassword}
                className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => { setShowDeleteDialog(false); setDeletePassword(''); setDeleteError(null) }}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface MemberData {
  id: string; userId: string; role: string
  canChat: boolean; canEditFiles: boolean; canManageGit: boolean
  canViewSettings: boolean; canEditSettings: boolean
  user: { id: string; email: string; displayName: string; avatarUrl?: string; githubUsername?: string }
}

function ProjectMembersSection({ projectId, isOwner }: { projectId: string; isOwner: boolean }) {
  const [members, setMembers] = useState<MemberData[]>([])
  const [owner, setOwner] = useState<{ id: string; displayName: string; avatarUrl?: string; githubUsername?: string } | null>(null)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<ProjectRole>('viewer')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<{ owner: typeof owner; members: MemberData[] }>(`/api/projects/${projectId}/members`)
      .then((d) => { setOwner(d.owner); setMembers(d.members) }).catch(() => {})
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!addEmail.trim()) return
    setIsAdding(true); setError(null)
    try {
      const field = addEmail.includes('@') ? 'email' : 'githubUsername'
      await api.post(`/api/projects/${projectId}/members`, { [field]: addEmail.trim(), role: addRole })
      setAddEmail('')
      load()
    } catch (err) { setError((err as Error).message) }
    finally { setIsAdding(false) }
  }

  const handleUpdate = async (userId: string, data: Record<string, unknown>) => {
    await api.patch(`/api/projects/${projectId}/members/${userId}`, data)
    load()
  }

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member?')) return
    await api.delete(`/api/projects/${projectId}/members/${userId}`)
    load()
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="font-medium">Project Members</h3>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Manage who has access to this project and what they can do.
      </p>

      {/* Owner */}
      {owner && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-[var(--accent)]/50 px-3 py-2">
          {owner.avatarUrl ? <img src={owner.avatarUrl} alt="" className="h-7 w-7 rounded-full" /> : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold">{owner.displayName[0]}</div>}
          <div className="flex-1">
            <span className="text-sm font-medium">{owner.displayName}</span>
            {owner.githubUsername && <span className="ml-2 text-xs text-[var(--muted-foreground)]">@{owner.githubUsername}</span>}
          </div>
          <span className="rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">OWNER</span>
        </div>
      )}

      {/* Members list */}
      {members.map((m) => (
        <div key={m.id} className="mt-2 rounded-lg border border-[var(--border)] px-3 py-2">
          <div className="flex items-center gap-3">
            {m.user.avatarUrl ? <img src={m.user.avatarUrl} alt="" className="h-7 w-7 rounded-full" /> : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-bold">{m.user.displayName[0]}</div>}
            <div className="flex-1">
              <span className="text-sm font-medium">{m.user.displayName}</span>
              {m.user.githubUsername && <span className="ml-2 text-xs text-[var(--muted-foreground)]">@{m.user.githubUsername}</span>}
            </div>
            {isOwner && (
              <>
                <select value={m.role} onChange={(e) => handleUpdate(m.userId, { role: e.target.value })} className="rounded border border-[var(--input)] bg-[var(--background)] px-2 py-1 text-xs">
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button onClick={() => handleRemove(m.userId)} className="text-xs text-[var(--destructive)] hover:underline">Remove</button>
              </>
            )}
          </div>
          {isOwner && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(['canChat', 'canEditFiles', 'canManageGit', 'canViewSettings', 'canEditSettings'] as const).map((perm) => (
                <label key={perm} className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                  <input type="checkbox" checked={m[perm]} onChange={(e) => handleUpdate(m.userId, { [perm]: e.target.checked })} className="h-3 w-3 rounded" />
                  {perm.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add member */}
      {isOwner && (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Email or @github username"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
            <select value={addRole} onChange={(e) => setAddRole(e.target.value as ProjectRole)} className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-2 py-2 text-sm">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button onClick={handleAdd} disabled={isAdding || !addEmail.trim()} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {isAdding ? '...' : 'Add'}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-[var(--destructive)]">{error}</p>}
        </div>
      )}
    </div>
  )
}

