'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import Editor, { type OnMount } from '@monaco-editor/react'
import { api } from '@/lib/api-client'
import type { FileNode } from '@axy/shared'

// ─── Types ──────────────────────────────────────────────

interface OpenTab {
  path: string
  name: string
  content: string
  originalContent: string
  node: FileNode
}

// ─── Language Detection ─────────────────────────────────

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  py: 'python',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  rs: 'rust',
  go: 'go',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  dockerfile: 'dockerfile',
  graphql: 'graphql',
  gql: 'graphql',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  rb: 'ruby',
  php: 'php',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  vue: 'html',
  env: 'ini',
  ini: 'ini',
  conf: 'ini',
  lock: 'json',
}

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function detectLanguage(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile'
  if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile'
  const ext = getFileExtension(fileName)
  return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext'
}

// ─── Helpers ────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIconColor(node: FileNode): string {
  if (node.type === 'directory') return 'text-yellow-500'
  const ext = getFileExtension(node.name)
  switch (ext) {
    case 'ts': case 'tsx': return 'text-blue-400'
    case 'js': case 'jsx': return 'text-yellow-400'
    case 'json': return 'text-gray-400'
    case 'md': case 'mdx': return 'text-purple-400'
    case 'css': case 'scss': case 'sass': return 'text-pink-400'
    case 'html': return 'text-orange-400'
    case 'svg': case 'png': case 'jpg': case 'jpeg': case 'gif': case 'ico': return 'text-green-400'
    case 'yml': case 'yaml': case 'toml': return 'text-red-400'
    case 'sh': case 'bash': case 'zsh': return 'text-green-500'
    case 'env': return 'text-yellow-600'
    case 'lock': return 'text-gray-500'
    default: return 'text-[var(--muted-foreground)]'
  }
}

function getFileIcon(node: FileNode, expanded?: boolean): string {
  if (node.type === 'directory') return expanded ? '\u{1F4C2}' : '\u{1F4C1}'
  const ext = getFileExtension(node.name)
  switch (ext) {
    case 'ts': case 'tsx': return 'TS'
    case 'js': case 'jsx': return 'JS'
    case 'json': return '{}'
    case 'md': case 'mdx': return '#'
    case 'css': case 'scss': return '*'
    case 'html': return '<>'
    case 'svg': case 'png': case 'jpg': case 'jpeg': case 'gif': case 'ico': return '\u{229E}'
    case 'yml': case 'yaml': case 'toml': return '\u{2699}'
    case 'sh': case 'bash': case 'zsh': return '$'
    case 'lock': return '\u{1F512}'
    default: return '\u{25A0}'
  }
}

function isBinaryExtension(name: string): boolean {
  const ext = getFileExtension(name)
  const binaryExts = [
    'png', 'jpg', 'jpeg', 'gif', 'ico', 'bmp', 'webp', 'avif',
    'woff', 'woff2', 'ttf', 'otf', 'eot',
    'zip', 'tar', 'gz', 'rar', '7z',
    'pdf', 'doc', 'docx', 'xls', 'xlsx',
    'mp3', 'mp4', 'wav', 'avi', 'mov',
    'exe', 'dll', 'so', 'dylib',
  ]
  return binaryExts.includes(ext)
}

// ─── Confirm Dialog ─────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="mx-4 w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-semibold text-[var(--foreground)]">{title}</h4>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--destructive)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--destructive)]/90 disabled:opacity-50"
          >
            {isLoading && <LoadingSpinner size="sm" />}
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Feedback Toast ─────────────────────────────────────

function FeedbackToast({ message, type, visible }: { message: string; type: 'success' | 'error'; visible: boolean }) {
  if (!visible) return null
  const colors =
    type === 'success'
      ? 'border-green-500/30 bg-green-500/15 text-green-400'
      : 'border-[var(--destructive)]/30 bg-[var(--destructive)]/15 text-[var(--destructive)]'
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className={`rounded-lg border ${colors} px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm`}>
        {message}
      </div>
    </div>
  )
}

// ─── File Tree Item ─────────────────────────────────────

interface FileTreeItemProps {
  node: FileNode
  depth?: number
  selectedPath: string | null
  expandedDirs: Set<string>
  onSelectFile: (node: FileNode) => void
  onToggleDir: (path: string) => void
  onDeleteFile: (node: FileNode) => void
}

function FileTreeItem({
  node,
  depth = 0,
  selectedPath,
  expandedDirs,
  onSelectFile,
  onToggleDir,
  onDeleteFile,
}: FileTreeItemProps) {
  const isDir = node.type === 'directory'
  const expanded = expandedDirs.has(node.path)
  const isSelected = selectedPath === node.path

  const handleClick = () => {
    if (isDir) {
      onToggleDir(node.path)
    } else {
      onSelectFile(node)
    }
  }

  const sortedChildren = useMemo(() => {
    if (!node.children) return []
    return [...node.children].sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.localeCompare(b.name)
    })
  }, [node.children])

  return (
    <div className="group/item">
      <div className="relative flex items-center">
        <button
          onClick={handleClick}
          className={`flex w-full items-center gap-1 rounded px-1.5 py-[2px] text-left text-[12px] transition-colors ${
            isSelected
              ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
              : 'text-[var(--foreground)] hover:bg-[var(--accent)]'
          }`}
          style={{ paddingLeft: `${depth * 12 + 4}px`, paddingRight: '24px' }}
          title={node.path}
        >
          <span
            className={`inline-flex w-2.5 shrink-0 items-center justify-center text-[8px] text-[var(--muted-foreground)] transition-transform ${
              isDir && expanded ? 'rotate-90' : ''
            }`}
          >
            {isDir ? '\u25B6' : ''}
          </span>

          <span
            className={`inline-flex w-4 shrink-0 items-center justify-center text-[10px] font-semibold ${getFileIconColor(node)}`}
          >
            {getFileIcon(node, expanded)}
          </span>

          <span className={`truncate ${isDir ? 'font-medium' : ''}`}>
            {node.name}
          </span>
        </button>

        {/* Delete button on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDeleteFile(node)
          }}
          className="absolute right-1 hidden h-4 w-4 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] group-hover/item:flex"
          title={`Delete ${node.name}`}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {isDir && expanded && sortedChildren.length > 0 && (
        <div>
          {sortedChildren.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              onSelectFile={onSelectFile}
              onToggleDir={onToggleDir}
              onDeleteFile={onDeleteFile}
            />
          ))}
        </div>
      )}

      {isDir && expanded && sortedChildren.length === 0 && (
        <div
          className="py-0.5 text-[10px] italic text-[var(--muted-foreground)]"
          style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
        >
          Empty
        </div>
      )}
    </div>
  )
}

// ─── Loading Spinner ────────────────────────────────────

function LoadingSpinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <svg
      className={`${cls} animate-spin`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Toast ──────────────────────────────────────────────

function SaveToast({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className="rounded-lg border border-green-500/30 bg-green-500/15 px-4 py-2 text-sm font-medium text-green-400 shadow-lg backdrop-blur-sm">
        Saved!
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────

export default function ProjectFilesPage() {
  const params = useParams()
  const projectId = params.id as string

  // File tree state
  const [tree, setTree] = useState<FileNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  // Tabs state
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveToast, setShowSaveToast] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Create file/folder state
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null)
  const [createPath, setCreatePath] = useState('')
  const [isCreateLoading, setIsCreateLoading] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Feedback toast
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  })

  // Upload / drag-and-drop state
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const dragCounter = useRef(0)
  const fileUploadRef = useRef<HTMLInputElement>(null)

  // Editor ref
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const saveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  // Active tab
  const activeTab = useMemo(
    () => openTabs.find((t) => t.path === activeTabPath) ?? null,
    [openTabs, activeTabPath]
  )

  // Check if tab has unsaved changes
  const isTabDirty = useCallback(
    (path: string) => {
      const tab = openTabs.find((t) => t.path === path)
      return tab ? tab.content !== tab.originalContent : false
    },
    [openTabs]
  )

  // Fetch file tree
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    api
      .get<FileNode[]>(`/api/files/projects/${projectId}`)
      .then(setTree)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [projectId])

  // Toggle directory
  const handleToggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // Open file in tab
  const handleSelectFile = useCallback(
    (node: FileNode) => {
      if (node.type === 'directory') return

      // If already open, just activate
      const existing = openTabs.find((t) => t.path === node.path)
      if (existing) {
        setActiveTabPath(node.path)
        return
      }

      // Mark as loading
      setLoadingPaths((prev) => new Set(prev).add(node.path))

      // Create placeholder tab and activate it
      const placeholder: OpenTab = {
        path: node.path,
        name: node.name,
        content: '',
        originalContent: '',
        node,
      }
      setOpenTabs((prev) => [...prev, placeholder])
      setActiveTabPath(node.path)

      // Load file content
      api
        .get<{ content: string }>(
          `/api/files/projects/${projectId}/read?path=${encodeURIComponent(node.path)}`
        )
        .then((data) => {
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.path === node.path
                ? { ...t, content: data.content, originalContent: data.content }
                : t
            )
          )
        })
        .catch(() => {
          // On error, remove the tab
          setOpenTabs((prev) => prev.filter((t) => t.path !== node.path))
          if (activeTabPath === node.path) {
            setActiveTabPath(null)
          }
        })
        .finally(() => {
          setLoadingPaths((prev) => {
            const next = new Set(prev)
            next.delete(node.path)
            return next
          })
        })
    },
    [projectId, openTabs, activeTabPath]
  )

  // Close tab
  const handleCloseTab = useCallback(
    (path: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation()
      }
      setOpenTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path)
        const next = prev.filter((t) => t.path !== path)

        // If we closed the active tab, activate an adjacent one
        if (activeTabPath === path) {
          if (next.length === 0) {
            setActiveTabPath(null)
          } else {
            const newIdx = Math.min(idx, next.length - 1)
            setActiveTabPath(next[newIdx].path)
          }
        }

        return next
      })
    },
    [activeTabPath]
  )

  // Handle editor content change
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeTabPath || value === undefined) return
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTabPath ? { ...t, content: value } : t
        )
      )
    },
    [activeTabPath]
  )

  // Save active file
  const handleSave = useCallback(async () => {
    if (!activeTab || !isTabDirty(activeTab.path)) return

    setIsSaving(true)
    setSaveError(null)

    try {
      await api.put<unknown>(`/api/files/projects/${projectId}/write`, {
        path: activeTab.path,
        content: activeTab.content,
      })

      // Mark as saved
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, originalContent: t.content }
            : t
        )
      )

      // Show toast
      setShowSaveToast(true)
      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current)
      saveToastTimerRef.current = setTimeout(() => setShowSaveToast(false), 2000)
    } catch (err) {
      setSaveError((err as Error).message)
      setTimeout(() => setSaveError(null), 4000)
    } finally {
      setIsSaving(false)
    }
  }, [activeTab, isTabDirty, projectId])

  // Show feedback toast
  const showFeedback = useCallback((message: string, type: 'success' | 'error') => {
    setFeedbackToast({ message, type, visible: true })
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setFeedbackToast((prev) => ({ ...prev, visible: false })), 2500)
  }, [])

  // Refresh file tree
  const refreshTree = useCallback(() => {
    api
      .get<FileNode[]>(`/api/files/projects/${projectId}`)
      .then(setTree)
      .catch(() => {})
  }, [projectId])

  // Create file or folder
  const handleCreate = useCallback(async () => {
    const trimmed = createPath.trim()
    if (!trimmed || !isCreating) return

    setIsCreateLoading(true)
    try {
      if (isCreating === 'folder') {
        await api.post(`/api/files/projects/${projectId}`, { path: trimmed, type: 'directory' })
        showFeedback(`Folder created: ${trimmed}`, 'success')
      } else {
        await api.post(`/api/files/projects/${projectId}`, { path: trimmed, content: '' })
        showFeedback(`File created: ${trimmed}`, 'success')
      }

      // Refresh tree
      refreshTree()

      // If it was a file, open it in editor after a short delay for tree refresh
      if (isCreating === 'file') {
        const fileName = trimmed.split('/').pop() || trimmed
        setTimeout(() => {
          const newNode: FileNode = { name: fileName, path: trimmed, type: 'file' }
          handleSelectFile(newNode)
        }, 300)
      }

      // Expand parent directories
      const parts = trimmed.split('/')
      if (parts.length > 1) {
        setExpandedDirs((prev) => {
          const next = new Set(prev)
          let parentPath = ''
          for (let i = 0; i < parts.length - 1; i++) {
            parentPath = parentPath ? `${parentPath}/${parts[i]}` : parts[i]
            next.add(parentPath)
          }
          return next
        })
      }

      setIsCreating(null)
      setCreatePath('')
    } catch (err) {
      showFeedback((err as Error).message || 'Failed to create', 'error')
    } finally {
      setIsCreateLoading(false)
    }
  }, [createPath, isCreating, projectId, showFeedback, refreshTree, handleSelectFile])

  // Delete file or folder
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await api.delete(`/api/files/projects/${projectId}?path=${encodeURIComponent(deleteTarget.path)}`)
      showFeedback(`Deleted: ${deleteTarget.name}`, 'success')

      // Close tab if the deleted file was open
      const tabToClose = openTabs.find((t) => t.path === deleteTarget.path)
      if (tabToClose) {
        handleCloseTab(deleteTarget.path)
      }

      refreshTree()
      setDeleteTarget(null)
    } catch (err) {
      showFeedback((err as Error).message || 'Failed to delete', 'error')
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, projectId, showFeedback, refreshTree, openTabs, handleCloseTab])

  // Handle delete request from tree item
  const handleDeleteRequest = useCallback((node: FileNode) => {
    setDeleteTarget(node)
  }, [])

  // Editor mount handler
  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor

      // Register Ctrl/Cmd+S
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        handleSave()
      })
    },
    [handleSave]
  )

  // Global keyboard shortcut for save (as fallback)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  // Sort root tree items
  const sortedTree = useMemo(() => {
    return [...tree].sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.localeCompare(b.name)
    })
  }, [tree])

  // Middle-click to close tab
  const handleTabMouseDown = useCallback(
    (path: string, e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
        handleCloseTab(path)
      }
    },
    [handleCloseTab]
  )

  // ─── File upload helpers ──────────────────────────────

  const readFileAsBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data:...;base64, prefix
        const base64 = result.split(',')[1] || result
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  // Recursively collect files from a DataTransferItem (for folder drops)
  const collectEntries = useCallback(async (items: DataTransferItemList): Promise<{ path: string; file: File }[]> => {
    const result: { path: string; file: File }[] = []

    async function traverseEntry(entry: FileSystemEntry, basePath: string) {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject)
        })
        result.push({ path: basePath + file.name, file })
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry
        const reader = dirEntry.createReader()
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject)
        })
        for (const child of entries) {
          await traverseEntry(child, basePath + entry.name + '/')
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.()
      if (entry) {
        await traverseEntry(entry, '')
      }
    }

    return result
  }, [])

  const uploadFiles = useCallback(async (filesToUpload: { path: string; file: File }[]) => {
    if (filesToUpload.length === 0) return

    setIsUploading(true)
    setUploadProgress(`Uploading ${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}...`)

    try {
      // Encode all files as base64
      const encoded: { path: string; data: string }[] = []
      for (let i = 0; i < filesToUpload.length; i++) {
        const f = filesToUpload[i]
        setUploadProgress(`Encoding ${i + 1}/${filesToUpload.length}: ${f.path}`)
        const data = await readFileAsBase64(f.file)
        encoded.push({ path: f.path, data })
      }

      setUploadProgress(`Uploading to server...`)
      const res = await api.post<{ uploaded: { path: string; success: boolean; error?: string }[] }>(
        `/api/files/projects/${projectId}/upload`,
        { files: encoded }
      )

      const successes = res.uploaded.filter((r) => r.success).length
      const failures = res.uploaded.filter((r) => !r.success)

      if (failures.length > 0) {
        showFeedback(`Uploaded ${successes}/${filesToUpload.length} files. ${failures.length} failed.`, 'error')
      } else {
        showFeedback(`Uploaded ${successes} file${successes > 1 ? 's' : ''} successfully`, 'success')
      }

      refreshTree()
    } catch (err) {
      showFeedback(`Upload failed: ${(err as Error).message}`, 'error')
    } finally {
      setIsUploading(false)
      setUploadProgress('')
    }
  }, [projectId, readFileAsBase64, showFeedback, refreshTree])

  // Handle drop event
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    if (isUploading) return

    const items = e.dataTransfer.items
    if (items && items.length > 0) {
      // Try to get entries (supports folder drops)
      const firstEntry = items[0].webkitGetAsEntry?.()
      if (firstEntry) {
        const collected = await collectEntries(items)
        if (collected.length > 0) {
          await uploadFiles(collected)
          return
        }
      }
    }

    // Fallback: plain file list
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const toUpload = files.map((f) => ({ path: f.name, file: f }))
      await uploadFiles(toUpload)
    }
  }, [isUploading, collectEntries, uploadFiles])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Handle file input change (click to upload)
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const toUpload = files.map((f) => ({ path: f.name, file: f }))
    await uploadFiles(toUpload)
    // Reset input
    if (fileUploadRef.current) fileUploadRef.current.value = ''
  }, [uploadFiles])

  // ─── Loading state ────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Files</h2>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--muted-foreground)]">
          <LoadingSpinner />
          Loading file tree...
        </div>
      </div>
    )
  }

  // ─── Error state ──────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Files</h2>
        <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          Failed to load files: {error}
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────

  const activeIsDirty = activeTab ? isTabDirty(activeTab.path) : false
  const activeIsBinary = activeTab ? isBinaryExtension(activeTab.name) : false
  const activeIsLoading = activeTab ? loadingPaths.has(activeTab.path) : false

  return (
    <div
      className="space-y-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Files</h2>
        <div className="flex items-center gap-2">
          {isUploading && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <LoadingSpinner size="sm" />
              {uploadProgress}
            </span>
          )}
          <button
            onClick={() => fileUploadRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Files
          </button>
          <input
            ref={fileUploadRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      <div
        className={`relative flex overflow-hidden rounded-lg border bg-[var(--card)] transition-colors ${
          isDragging
            ? 'border-[var(--primary)] bg-[var(--primary)]/5'
            : 'border-[var(--border)]'
        }`}
        style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[var(--primary)]/10 backdrop-blur-[1px]">
            <div className="rounded-xl border-2 border-dashed border-[var(--primary)] bg-[var(--card)]/90 px-8 py-6 text-center shadow-lg">
              <svg className="mx-auto h-10 w-10 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="mt-2 text-sm font-medium text-[var(--primary)]">Drop files here to upload</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Files & folders supported</p>
            </div>
          </div>
        )}
        {/* Left Panel: File Tree */}
        <div className="flex w-[280px] shrink-0 flex-col border-r border-[var(--border)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Explorer
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              {/* New File button */}
              <button
                onClick={() => {
                  setIsCreating('file')
                  setCreatePath('')
                  setTimeout(() => createInputRef.current?.focus(), 50)
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="New File"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              {/* New Folder button */}
              <button
                onClick={() => {
                  setIsCreating('folder')
                  setCreatePath('')
                  setTimeout(() => createInputRef.current?.focus(), 50)
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="New Folder"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m3-3H9m-4 7h14a2 2 0 002-2V8a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Inline create input */}
          {isCreating && (
            <div className="border-b border-[var(--border)] px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {isCreating === 'file' ? '+' : '\u{1F4C1}'}
                </span>
                <input
                  ref={createInputRef}
                  type="text"
                  value={createPath}
                  onChange={(e) => setCreatePath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') {
                      setIsCreating(null)
                      setCreatePath('')
                    }
                  }}
                  placeholder={isCreating === 'file' ? 'path/to/file.ts' : 'path/to/folder'}
                  disabled={isCreateLoading}
                  className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 text-[11px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60 focus:border-[var(--primary)] focus:outline-none disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  disabled={isCreateLoading || !createPath.trim()}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-green-400 transition-colors hover:bg-green-500/15 disabled:opacity-40"
                  title="Confirm"
                >
                  {isCreateLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(null)
                    setCreatePath('')
                  }}
                  disabled={isCreateLoading}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                  title="Cancel"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-0.5">
            {sortedTree.length === 0 ? (
              <p className="p-4 text-center text-xs text-[var(--muted-foreground)]">
                No files found
              </p>
            ) : (
              sortedTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  selectedPath={activeTabPath}
                  expandedDirs={expandedDirs}
                  onSelectFile={handleSelectFile}
                  onToggleDir={handleToggleDir}
                  onDeleteFile={handleDeleteRequest}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Editor Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Tab Bar */}
          {openTabs.length > 0 && (
            <div className="flex items-center border-b border-[var(--border)] bg-[var(--card)]">
              <div className="flex flex-1 items-center overflow-x-auto">
                {openTabs.map((tab) => {
                  const isActive = tab.path === activeTabPath
                  const isDirty = isTabDirty(tab.path)
                  const isTabLoading = loadingPaths.has(tab.path)

                  return (
                    <button
                      key={tab.path}
                      onClick={() => setActiveTabPath(tab.path)}
                      onMouseDown={(e) => handleTabMouseDown(tab.path, e)}
                      className={`group flex shrink-0 items-center gap-1.5 border-r border-[var(--border)] px-3 py-1.5 text-[12px] transition-colors ${
                        isActive
                          ? 'bg-[var(--background)] text-[var(--foreground)]'
                          : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
                      }`}
                      title={tab.path}
                    >
                      <span className={`shrink-0 text-[10px] font-semibold ${getFileIconColor(tab.node)}`}>
                        {getFileIcon(tab.node)}
                      </span>
                      <span className="truncate max-w-[120px]">{tab.name}</span>
                      {isTabLoading && (
                        <span className="shrink-0">
                          <LoadingSpinner size="sm" />
                        </span>
                      )}
                      {isDirty && !isTabLoading && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-[var(--primary)]" title="Unsaved changes" />
                      )}
                      <span
                        onClick={(e) => handleCloseTab(tab.path, e)}
                        className={`ml-0.5 shrink-0 flex h-4 w-4 items-center justify-center rounded text-[14px] leading-none transition-colors hover:bg-[var(--accent)] ${
                          isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
                        }`}
                        role="button"
                        tabIndex={-1}
                      >
                        x
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Save button */}
              {activeTab && activeIsDirty && (
                <div className="flex shrink-0 items-center gap-2 px-2">
                  {saveError && (
                    <span className="text-[11px] text-[var(--destructive)]">
                      Save failed
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Editor Content */}
          {activeTab ? (
            <div className="relative flex-1 overflow-hidden">
              {activeIsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
                    <LoadingSpinner />
                    Loading file...
                  </div>
                </div>
              ) : activeIsBinary ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-sm text-[var(--muted-foreground)]">
                    <div className="mb-2 text-3xl">{'\u{229E}'}</div>
                    <p>Binary file cannot be displayed</p>
                    <p className="mt-1 text-xs">{activeTab.name}</p>
                  </div>
                </div>
              ) : (
                <Editor
                  key={activeTab.path}
                  theme="vs-dark"
                  language={detectLanguage(activeTab.name)}
                  value={activeTab.content}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 13,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    readOnly: false,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    renderWhitespace: 'selection',
                    bracketPairColorization: { enabled: true },
                    padding: { top: 8, bottom: 8 },
                    automaticLayout: true,
                    tabSize: 2,
                    formatOnPaste: false,
                    formatOnType: false,
                  }}
                  loading={
                    <div className="flex h-full items-center justify-center">
                      <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
                        <LoadingSpinner />
                        Loading editor...
                      </div>
                    </div>
                  }
                />
              )}

              {/* Status bar */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-[var(--border)] bg-[var(--card)] px-3 py-0.5 text-[11px] text-[var(--muted-foreground)]">
                <div className="flex items-center gap-3">
                  <span>{detectLanguage(activeTab.name)}</span>
                  <span>{activeTab.path}</span>
                </div>
                <div className="flex items-center gap-3">
                  {activeIsDirty && (
                    <span className="text-[var(--primary)]">Modified</span>
                  )}
                  <span>UTF-8</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-[var(--muted-foreground)]">
                <div className="mb-3 text-4xl opacity-30">{'\u{1F4C4}'}</div>
                <p className="text-sm font-medium">No file open</p>
                <p className="mt-1 text-xs">
                  Select a file from the explorer to start editing
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save toast */}
      <SaveToast visible={showSaveToast} />

      {/* Feedback toast */}
      <FeedbackToast message={feedbackToast.message} type={feedbackToast.type} visible={feedbackToast.visible} />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.type === 'directory' ? 'folder' : 'file'}`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />

      {/* Inline styles for the toast animation */}
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in-up 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
