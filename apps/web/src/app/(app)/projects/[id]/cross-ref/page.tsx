'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { FileNode } from '@axy/shared'

interface SiblingProject {
  id: string
  name: string
  description: string | null
  githubRepoFullName: string | null
  updatedAt: string
}

interface SearchResult {
  projectId: string
  projectName: string
  file: string
  line: number
  content: string
}

interface CrossRefFile {
  project: { id: string; name: string }
  tree: FileNode[]
}

export default function CrossRefPage() {
  const { id: projectId } = useParams() as { id: string }
  const [siblings, setSiblings] = useState<SiblingProject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<CrossRefFile | null>(null)
  const [loadingTree, setLoadingTree] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; project: string } | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchPattern, setSearchPattern] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    api.get<SiblingProject[]>(`/api/files/projects/${projectId}/siblings`)
      .then(setSiblings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  const browseProject = useCallback(async (targetId: string) => {
    setSelectedProject(targetId)
    setSelectedFile(null)
    setLoadingTree(true)
    try {
      const data = await api.get<CrossRefFile>(`/api/files/projects/${projectId}/cross-ref/${targetId}/tree?depth=4`)
      setFileTree(data)
    } catch {
      setFileTree(null)
    }
    setLoadingTree(false)
  }, [projectId])

  const readFile = useCallback(async (targetId: string, filePath: string) => {
    setLoadingFile(true)
    try {
      const data = await api.get<{ project: string; path: string; content: string }>(
        `/api/files/projects/${projectId}/cross-ref/${targetId}/read?path=${encodeURIComponent(filePath)}`
      )
      setSelectedFile(data)
    } catch {
      setSelectedFile(null)
    }
    setLoadingFile(false)
  }, [projectId])

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const results = await api.post<SearchResult[]>(`/api/files/projects/${projectId}/cross-ref/search`, {
        query: searchQuery.trim(),
        filePattern: searchPattern || undefined,
      })
      setSearchResults(results)
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }, [projectId, searchQuery, searchPattern])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Cross-Project Reference</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Browse and search files across sibling projects. Use <code className="rounded bg-[var(--secondary)] px-1">/cross-ref</code> in chat to let Claude access these.
        </p>
      </div>

      {/* Search across all projects */}
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Search Across Projects</h2>
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for APIs, types, functions..."
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
          <input
            type="text"
            value={searchPattern}
            onChange={(e) => setSearchPattern(e.target.value)}
            placeholder="*.ts"
            className="w-24 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            title="File pattern filter (e.g. *.ts, *.json)"
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-4 max-h-96 space-y-1 overflow-auto">
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">{searchResults.length} results found</p>
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => readFile(r.projectId, r.file)}
                className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                      {r.projectName}
                    </span>
                    <span className="truncate font-mono text-xs text-[var(--foreground)]">{r.file}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">L{r.line}</span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-[var(--muted-foreground)]">{r.content}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sibling project list */}
        <div className="lg:col-span-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Sibling Projects ({siblings.length})
          </h2>
          {siblings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">No sibling projects found</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Create more projects to enable cross-referencing</p>
            </div>
          ) : (
            <div className="space-y-2">
              {siblings.map((p) => (
                <button
                  key={p.id}
                  onClick={() => browseProject(p.id)}
                  className={`flex w-full flex-col rounded-lg border px-4 py-3 text-left transition-all ${
                    selectedProject === p.id
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40'
                  }`}
                >
                  <span className="text-sm font-medium text-[var(--foreground)]">{p.name}</span>
                  {p.description && (
                    <span className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{p.description}</span>
                  )}
                  {p.githubRepoFullName && (
                    <span className="mt-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">{p.githubRepoFullName}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* File tree + content */}
        <div className="lg:col-span-8">
          {!selectedProject ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
              <p className="text-sm text-[var(--muted-foreground)]">Select a project to browse its files</p>
            </div>
          ) : loadingTree ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {fileTree && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                    {fileTree.project.name} - File Tree
                  </h3>
                  <div className="max-h-80 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
                    <FileTreeView
                      nodes={fileTree.tree}
                      projectPath={fileTree.project.name}
                      onSelect={(filePath) => readFile(selectedProject, filePath)}
                      basePath=""
                    />
                  </div>
                </div>
              )}

              {/* File content viewer */}
              {loadingFile ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                </div>
              ) : selectedFile && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
                    <div>
                      <span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                        {selectedFile.project}
                      </span>
                      <span className="ml-2 font-mono text-xs text-[var(--foreground)]">{selectedFile.path}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedFile.content)}
                      className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="max-h-96 overflow-auto p-4 font-mono text-xs text-[var(--foreground)]">
                    {selectedFile.content}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Recursive file tree component
function FileTreeView({
  nodes,
  onSelect,
  basePath,
  depth = 0,
}: {
  nodes: FileNode[]
  projectPath: string
  onSelect: (path: string) => void
  basePath: string
  depth?: number
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  return (
    <div style={{ paddingLeft: depth > 0 ? '16px' : '0' }}>
      {nodes.map((node) => {
        const fullPath = basePath ? `${basePath}/${node.name}` : node.name
        if (node.type === 'directory') {
          const isOpen = expanded[node.name]
          return (
            <div key={node.name}>
              <button
                onClick={() => setExpanded((e) => ({ ...e, [node.name]: !e[node.name] }))}
                className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs transition-colors hover:bg-[var(--accent)]"
              >
                <svg className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <svg className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="text-[var(--foreground)]">{node.name}</span>
              </button>
              {isOpen && node.children && (
                <FileTreeView nodes={node.children} projectPath="" onSelect={onSelect} basePath={fullPath} depth={depth + 1} />
              )}
            </div>
          )
        }
        return (
          <button
            key={node.name}
            onClick={() => onSelect(fullPath)}
            className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs transition-colors hover:bg-[var(--accent)]"
            style={{ paddingLeft: `${(depth > 0 ? 16 : 0) + 20}px` }}
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[var(--muted-foreground)]">{node.name}</span>
            {node.size !== undefined && (
              <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">
                {node.size > 1024 ? `${(node.size / 1024).toFixed(1)}KB` : `${node.size}B`}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
