'use client'

import { useState } from 'react'
import type { FileNode } from '@axy/shared'

function getExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function fileIconColor(node: FileNode): string {
  if (node.type === 'directory') return 'text-yellow-400/80'
  switch (getExt(node.name)) {
    case 'ts': case 'tsx': return 'text-blue-400'
    case 'js': case 'jsx': return 'text-yellow-400'
    case 'json': return 'text-amber-300'
    case 'md': case 'mdx': return 'text-purple-300'
    case 'css': case 'scss': case 'sass': return 'text-pink-400'
    case 'html': return 'text-orange-400'
    case 'py': return 'text-green-400'
    case 'go': return 'text-cyan-400'
    case 'rs': return 'text-orange-300'
    case 'kt': case 'java': return 'text-red-300'
    case 'yml': case 'yaml': case 'toml': return 'text-red-400'
    case 'sh': case 'bash': return 'text-green-500'
    case 'env': return 'text-yellow-600'
    case 'lock': return 'text-gray-500'
    default: return 'text-[var(--muted-foreground)]'
  }
}

function fileIcon(node: FileNode, expanded?: boolean): string {
  if (node.type === 'directory') return expanded ? '▾' : '▸'
  switch (getExt(node.name)) {
    case 'ts': case 'tsx': return 'TS'
    case 'js': case 'jsx': return 'JS'
    case 'json': return '{}'
    case 'md': case 'mdx': return '#'
    case 'css': case 'scss': return '*'
    case 'html': return '<>'
    case 'svg': case 'png': case 'jpg': case 'jpeg': case 'gif': return '◇'
    case 'yml': case 'yaml': case 'toml': return '⚙'
    case 'sh': case 'bash': return '$'
    case 'lock': return '🔒'
    default: return '•'
  }
}

interface TreeItemProps {
  node: FileNode
  depth: number
  selectedPath: string | null
  onSelect: (node: FileNode) => void
}

function TreeItem({ node, depth, selectedPath, onSelect }: TreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1)
  const isSelected = selectedPath === node.path
  const isDir = node.type === 'directory'

  const handleClick = () => {
    if (isDir) setExpanded((v) => !v)
    else onSelect(node)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`group flex w-full items-center gap-1.5 px-2 py-[3px] text-left text-[12px] transition-colors ${
          isSelected
            ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
            : 'text-[var(--foreground)] hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {isDir ? (
          <span className="w-3 text-[10px] text-[var(--muted-foreground)]">
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="w-3" />
        )}
        <span className={`w-5 shrink-0 text-center font-mono text-[10px] font-bold ${fileIconColor(node)}`}>
          {isDir ? (expanded ? '📂' : '📁') : fileIcon(node)}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && expanded && node.children && (
        <>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  )
}

export function WorkspaceFileTree({
  tree,
  selectedPath,
  onSelect,
  onRefresh,
}: {
  tree: FileNode[]
  selectedPath: string | null
  onSelect: (node: FileNode) => void
  onRefresh?: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        <span>Explorer</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-white/5 hover:text-[var(--foreground)]"
            title="Refresh"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto pb-2">
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-[var(--muted-foreground)]">No files yet</div>
        ) : (
          tree.map((n) => (
            <TreeItem key={n.path} node={n} depth={0} selectedPath={selectedPath} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  )
}
