'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProjectStore } from '@/stores/project.store'
import { api } from '@/lib/api-client'
import { TemplatePicker } from './templates'
import type { PermissionMode } from '@axy/shared'

type Tab = 'github' | 'new' | 'upload'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  clone_url: string
  private: boolean
  language: string | null
  updated_at: string
  default_branch: string
}

export default function NewProjectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId') || undefined
  const createProject = useProjectStore((s) => s.createProject)
  const uploadProject = useProjectStore((s) => s.uploadProject)
  const [activeTab, setActiveTab] = useState<Tab>('github')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // GitHub import state
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([])
  const [repoSearch, setRepoSearch] = useState('')
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [cloneStatus, setCloneStatus] = useState<string | null>(null)
  const [githubPermission, setGithubPermission] = useState<PermissionMode>('default')

  // New project state
  const [useTemplate, setUseTemplate] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [templateStatus, setTemplateStatus] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    githubRepoUrl: '',
    permissionMode: 'default' as PermissionMode,
  })

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadPermission, setUploadPermission] = useState<PermissionMode>('default')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Load GitHub repos on mount
  useEffect(() => {
    loadRepos()
  }, [])

  // Filter repos when search changes
  useEffect(() => {
    if (!repoSearch.trim()) {
      setFilteredRepos(repos)
    } else {
      const q = repoSearch.toLowerCase()
      setFilteredRepos(repos.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      ))
    }
  }, [repoSearch, repos])

  const loadRepos = async () => {
    setIsLoadingRepos(true)
    try {
      const data = await api.get<GitHubRepo[]>('/api/github/repos')
      const repoList = Array.isArray(data) ? data : []
      setRepos(repoList)
      setFilteredRepos(repoList)
    } catch (err) {
      console.error('Failed to load repos:', err)
    } finally {
      setIsLoadingRepos(false)
    }
  }

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo)
    setError(null)
  }

  const handleGitHubImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRepo) return

    setIsSubmitting(true)
    setError(null)
    setCloneStatus('Creating project...')
    try {
      const project = await createProject({
        name: selectedRepo.name,
        description: selectedRepo.description || undefined,
        githubRepoUrl: selectedRepo.html_url,
        permissionMode: githubPermission,
        orgId,
      })

      setCloneStatus('Cloning repository...')
      await api.post('/api/git/clone', {
        repoUrl: selectedRepo.clone_url,
        projectId: project.id,
        branch: selectedRepo.default_branch,
      })

      setCloneStatus('Done! Redirecting...')
      router.push(`/projects/${project.id}`)
    } catch (err) {
      setError((err as Error).message)
      setCloneStatus(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return

    setIsSubmitting(true)
    setError(null)
    setTemplateStatus(null)
    try {
      const project = await createProject({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        githubRepoUrl: form.githubRepoUrl.trim() || undefined,
        permissionMode: form.permissionMode,
        orgId,
      })

      if (useTemplate && selectedTemplateId) {
        setTemplateStatus('Setting up template...')
        try {
          await api.post('/api/templates/apply', {
            projectId: project.id,
            templateId: selectedTemplateId,
          })
        } catch (templateErr) {
          console.error('Template apply failed:', templateErr)
        }
      }

      router.push(`/projects/${project.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
      setTemplateStatus(null)
    }
  }

  const handleFiles = useCallback((fileList: FileList) => {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploadFiles(files)
    const firstPath = (files[0] as any).webkitRelativePath || files[0].name
    const folderName = firstPath.split('/')[0] || 'uploaded-project'
    if (!uploadName) setUploadName(folderName)
    setUploadProgress(`${files.length} files selected`)
  }, [uploadName])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const items = Array.from(e.dataTransfer.items)
    const allFiles: File[] = []

    async function readAllEntries(dirReader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
      const all: FileSystemEntry[] = []
      let batch: FileSystemEntry[]
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve) => dirReader.readEntries(resolve))
        all.push(...batch)
      } while (batch.length > 0)
      return all
    }

    async function readEntry(entry: FileSystemEntry, path: string): Promise<void> {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => {
          (entry as FileSystemFileEntry).file(resolve)
        })
        const relativePath = path + file.name
        const newFile = new File([file], relativePath, { type: file.type })
        allFiles.push(newFile)
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader()
        const entries = await readAllEntries(dirReader)
        for (const child of entries) {
          await readEntry(child, path + entry.name + '/')
        }
      }
    }

    setUploadProgress('Scanning folder...')
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.()
      if (entry) await readEntry(entry, '')
    }

    if (allFiles.length > 0) {
      setUploadFiles(allFiles)
      const firstPath = allFiles[0].name
      const folderName = firstPath.split('/')[0] || 'uploaded-project'
      if (!uploadName) setUploadName(folderName)
      setUploadProgress(`${allFiles.length} files ready`)
    }
  }, [uploadName])

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadName.trim() || uploadFiles.length === 0 || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    setUploadProgress('Creating project...')
    try {
      const project = await uploadProject({
        name: uploadName.trim(),
        description: uploadDesc.trim() || undefined,
        permissionMode: uploadPermission,
        orgId,
        files: uploadFiles,
        onProgress: setUploadProgress,
      })
      setUploadProgress('Done! Redirecting...')
      router.push(`/projects/${project.id}`)
    } catch (err) {
      setError((err as Error).message)
      setUploadProgress(null)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New Project</h1>

      {/* Tab Selector */}
      <div className="flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-1">
        {([
          { id: 'github' as Tab, label: 'Import from GitHub' },
          { id: 'new' as Tab, label: 'Empty Project' },
          { id: 'upload' as Tab, label: 'Upload Folder' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id); setError(null) }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      )}

      {/* GitHub Import */}
      {activeTab === 'github' && (
        <form onSubmit={handleGitHubImport} className="space-y-4">
          {/* Search */}
          <div>
            <label className="mb-1 block text-sm font-medium">Search your repositories</label>
            <input
              type="text"
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Repo list */}
          <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-1">
            {isLoadingRepos ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                <span className="ml-2 text-sm text-[var(--muted-foreground)]">Loading repositories...</span>
              </div>
            ) : filteredRepos.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                {repos.length === 0 ? 'No repositories found.' : 'No matches found.'}
              </p>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => handleSelectRepo(repo)}
                  className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                    selectedRepo?.id === repo.id
                      ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30'
                      : 'hover:bg-[var(--accent)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{repo.full_name}</span>
                      {repo.private && (
                        <span className="shrink-0 rounded-full bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                          private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{repo.description}</p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                      {repo.language && <span>{repo.language}</span>}
                      <span>{new Date(repo.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {selectedRepo?.id === repo.id && (
                    <svg className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Selected repo info */}
          {selectedRepo && (
            <div className="rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-3">
              <p className="text-sm font-medium">{selectedRepo.full_name}</p>
              {selectedRepo.description && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{selectedRepo.description}</p>
              )}
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Branch: {selectedRepo.default_branch} &middot; {selectedRepo.private ? 'Private' : 'Public'}
              </p>
            </div>
          )}

          <PermissionSelect value={githubPermission} onChange={setGithubPermission} />

          {cloneStatus && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              {cloneStatus}
            </div>
          )}

          <FormButtons
            isSubmitting={isSubmitting}
            disabled={!selectedRepo}
            label="Import & Clone Repository"
            onCancel={() => router.back()}
          />
        </form>
      )}

      {/* New Project Form */}
      {activeTab === 'new' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Project Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="my-awesome-project"
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this project about?"
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
          {/* Template toggle */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={useTemplate}
                onClick={() => {
                  setUseTemplate(!useTemplate)
                  if (useTemplate) setSelectedTemplateId('')
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  useTemplate ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    useTemplate ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
              <span className="text-sm font-medium">Use a Template</span>
            </label>
            {useTemplate && (
              <TemplatePicker
                selectedId={selectedTemplateId}
                onSelect={setSelectedTemplateId}
              />
            )}
          </div>

          <PermissionSelect value={form.permissionMode} onChange={(v) => setForm({ ...form, permissionMode: v })} />
          {templateStatus && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              {templateStatus}
            </div>
          )}
          <FormButtons
            isSubmitting={isSubmitting}
            disabled={!form.name.trim()}
            label={useTemplate && selectedTemplateId ? 'Create with Template' : 'Create Project'}
            onCancel={() => router.back()}
          />
        </form>
      )}

      {/* Upload Folder */}
      {activeTab === 'upload' && (
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => folderInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragOver
                ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                : uploadFiles.length > 0
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--accent)]/50'
            }`}
          >
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is valid but not in types
              webkitdirectory=""
              directory=""
              multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
            {uploadFiles.length > 0 ? (
              <div>
                <svg className="mx-auto mb-2 h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-green-400">{uploadProgress}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Click or drag to replace</p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto mb-2 h-10 w-10 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-[var(--foreground)]">Drag & drop a folder here</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">or click to select a folder</p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Project Name *</label>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="my-project"
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          <PermissionSelect value={uploadPermission} onChange={setUploadPermission} />
          <FormButtons
            isSubmitting={isSubmitting}
            disabled={!uploadName.trim() || uploadFiles.length === 0}
            label={isSubmitting ? 'Uploading...' : 'Upload & Create Project'}
            onCancel={() => router.back()}
          />
        </form>
      )}
    </div>
  )
}

function PermissionSelect({ value, onChange }: { value: PermissionMode; onChange: (v: PermissionMode) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Permission Mode</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PermissionMode)}
        className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
      >
        <option value="default">Default (ask for permissions)</option>
        <option value="accept_edits">Accept Edits (auto-approve file changes)</option>
        <option value="plan">Plan Only (read-only mode)</option>
        <option value="bypass">Bypass Permissions (dangerous)</option>
      </select>
      {value === 'bypass' && (
        <p className="mt-1 text-xs text-[var(--destructive)]">
          Warning: Claude will execute any operation without asking for permission.
        </p>
      )}
    </div>
  )
}

function FormButtons({ isSubmitting, disabled, label, onCancel }: {
  isSubmitting: boolean; disabled: boolean; label: string; onCancel: () => void
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="submit"
        disabled={isSubmitting || disabled}
        className="rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Processing...' : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-[var(--border)] px-6 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
      >
        Cancel
      </button>
    </div>
  )
}
