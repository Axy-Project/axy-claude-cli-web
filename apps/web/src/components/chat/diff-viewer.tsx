'use client'

import { useState, useMemo, useCallback } from 'react'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface DiffViewerProps {
  filename: string
  oldContent?: string
  newContent?: string
  /** Pre-computed unified diff string */
  diff?: string
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  oldLineNo?: number
  newLineNo?: number
}

// ────────────────────────────────────────────────────────────
// LCS-based diff algorithm (O(n*m))
// ────────────────────────────────────────────────────────────

function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp
}

function computeDiffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  const dp = computeLCS(oldLines, newLines)
  const result: DiffLine[] = []

  let i = oldLines.length
  let j = newLines.length

  // Backtrack through LCS table
  const stack: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: 'unchanged', content: oldLines[i - 1], oldLineNo: i, newLineNo: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'added', content: newLines[j - 1], newLineNo: j })
      j--
    } else if (i > 0) {
      stack.push({ type: 'removed', content: oldLines[i - 1], oldLineNo: i })
      i--
    }
  }

  // Reverse since we built it backwards
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k])
  }

  return result
}

function parseDiffString(diff: string): DiffLine[] {
  const lines = diff.split('\n')
  const result: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    // Skip diff headers
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
      continue
    }

    // Parse hunk header
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10)
      newLine = parseInt(hunkMatch[2], 10)
      continue
    }

    if (line.startsWith('+')) {
      result.push({ type: 'added', content: line.slice(1), newLineNo: newLine++ })
    } else if (line.startsWith('-')) {
      result.push({ type: 'removed', content: line.slice(1), oldLineNo: oldLine++ })
    } else if (line.startsWith(' ') || line === '') {
      result.push({
        type: 'unchanged',
        content: line.startsWith(' ') ? line.slice(1) : line,
        oldLineNo: oldLine++,
        newLineNo: newLine++,
      })
    }
  }

  return result
}

// ────────────────────────────────────────────────────────────
// Helper to detect file edit tool calls
// ────────────────────────────────────────────────────────────

const EDIT_TOOL_PATTERNS = [
  'edit', 'write', 'str_replace_editor', 'write_file', 'edit_file',
  'create_file', 'insert', 'replace', 'patch',
]

export function isFileEditTool(toolName: string): boolean {
  const lower = toolName.toLowerCase()
  return EDIT_TOOL_PATTERNS.some((p) => lower.includes(p))
}

export interface ExtractedDiffData {
  filename: string
  oldContent?: string
  newContent?: string
}

export function extractDiffData(
  toolName: string,
  input: Record<string, unknown>
): ExtractedDiffData | null {
  if (!isFileEditTool(toolName)) return null

  const filename =
    (input.file_path as string) ||
    (input.path as string) ||
    (input.filename as string) ||
    (input.target_file as string) ||
    ''

  if (!filename) return null

  // str_replace_editor / Edit-style: old_string -> new_string
  const oldStr = (input.old_string as string) ?? (input.old_content as string)
  const newStr = (input.new_string as string) ?? (input.new_content as string)

  if (oldStr !== undefined && newStr !== undefined) {
    return { filename, oldContent: oldStr, newContent: newStr }
  }

  // Write / create style: only new content
  const content = (input.content as string) ?? (input.file_text as string)
  if (content !== undefined) {
    return { filename, oldContent: '', newContent: content }
  }

  return null
}

// ────────────────────────────────────────────────────────────
// DiffViewer Component
// ────────────────────────────────────────────────────────────

export function DiffViewer({ filename, oldContent, newContent, diff }: DiffViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')
  const [copied, setCopied] = useState(false)

  const diffLines = useMemo(() => {
    if (diff) {
      return parseDiffString(diff)
    }
    const oldLines = (oldContent ?? '').split('\n')
    const newLines = (newContent ?? '').split('\n')
    return computeDiffLines(oldLines, newLines)
  }, [diff, oldContent, newContent])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    for (const line of diffLines) {
      if (line.type === 'added') added++
      if (line.type === 'removed') removed++
    }
    return { added, removed, total: added + removed }
  }, [diffLines])

  const copyNewContent = useCallback(() => {
    const text = newContent ?? diffLines.filter((l) => l.type !== 'removed').map((l) => l.content).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [newContent, diffLines])

  // Short filename for display
  const shortName = filename.split('/').slice(-2).join('/')

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--secondary)]/50 transition-colors"
      >
        {/* Expand chevron */}
        <svg
          className={`h-3 w-3 shrink-0 text-[var(--muted-foreground)] transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        {/* File icon */}
        <svg className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>

        {/* Filename */}
        <span className="min-w-0 truncate font-mono text-xs text-[var(--foreground)]" title={filename}>
          {shortName}
        </span>

        {/* Stats */}
        <span className="ml-auto flex shrink-0 items-center gap-2 text-[10px] font-medium">
          {stats.added > 0 && (
            <span className="text-green-400">+{stats.added}</span>
          )}
          {stats.removed > 0 && (
            <span className="text-red-400">-{stats.removed}</span>
          )}
          {!expanded && (
            <span className="text-[var(--muted-foreground)]">
              {stats.total} line{stats.total !== 1 ? 's' : ''} changed
            </span>
          )}
        </span>
      </button>

      {/* Expanded diff view */}
      {expanded && (
        <div className="border-t border-[var(--border)]">
          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--secondary)]/30 px-3 py-1.5">
            {/* View mode toggle */}
            <div className="flex rounded border border-[var(--border)] text-[10px]">
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                className={`px-2 py-0.5 transition-colors ${
                  viewMode === 'unified'
                    ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Unified
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`border-l border-[var(--border)] px-2 py-0.5 transition-colors ${
                  viewMode === 'split'
                    ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Split
              </button>
            </div>

            <span className="ml-auto" />

            {/* Copy button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                copyNewContent()
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              title="Copy new content"
            >
              {copied ? (
                <>
                  <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-400">Copied</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Diff content */}
          <div className="max-h-[500px] overflow-auto">
            {viewMode === 'unified' ? (
              <UnifiedView lines={diffLines} />
            ) : (
              <SplitView lines={diffLines} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Unified View
// ────────────────────────────────────────────────────────────

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <table className="w-full border-collapse font-mono text-xs leading-5">
      <tbody>
        {lines.map((line, idx) => {
          const bgClass =
            line.type === 'added'
              ? 'bg-green-500/10'
              : line.type === 'removed'
                ? 'bg-red-500/10'
                : ''
          const textClass =
            line.type === 'added'
              ? 'text-green-400'
              : line.type === 'removed'
                ? 'text-red-400'
                : 'text-[var(--foreground)]'
          const marker =
            line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '

          return (
            <tr key={idx} className={bgClass}>
              {/* Old line number */}
              <td className="w-[1px] select-none whitespace-nowrap px-2 text-right text-[var(--muted-foreground)]/40 align-top">
                {line.oldLineNo ?? ''}
              </td>
              {/* New line number */}
              <td className="w-[1px] select-none whitespace-nowrap px-2 text-right text-[var(--muted-foreground)]/40 align-top">
                {line.newLineNo ?? ''}
              </td>
              {/* Marker */}
              <td className={`w-[1px] select-none whitespace-nowrap pl-2 pr-1 align-top ${textClass}`}>
                {marker}
              </td>
              {/* Content */}
              <td className={`whitespace-pre-wrap break-all pr-4 align-top ${textClass}`}>
                {line.content || '\u00A0'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ────────────────────────────────────────────────────────────
// Split View
// ────────────────────────────────────────────────────────────

function SplitView({ lines }: { lines: DiffLine[] }) {
  // Build paired left/right rows
  const pairs = useMemo(() => {
    const result: Array<{ left?: DiffLine; right?: DiffLine }> = []

    // Collect removals and additions in adjacent groups, then pair them
    let i = 0
    while (i < lines.length) {
      const line = lines[i]

      if (line.type === 'unchanged') {
        result.push({ left: line, right: line })
        i++
      } else {
        // Collect consecutive removals + additions
        const removals: DiffLine[] = []
        const additions: DiffLine[] = []

        while (i < lines.length && lines[i].type === 'removed') {
          removals.push(lines[i])
          i++
        }
        while (i < lines.length && lines[i].type === 'added') {
          additions.push(lines[i])
          i++
        }

        const maxLen = Math.max(removals.length, additions.length)
        for (let j = 0; j < maxLen; j++) {
          result.push({
            left: removals[j],
            right: additions[j],
          })
        }
      }
    }

    return result
  }, [lines])

  return (
    <table className="w-full border-collapse font-mono text-xs leading-5">
      <tbody>
        {pairs.map((pair, idx) => (
          <tr key={idx}>
            {/* Left side (old) */}
            <td className="w-[1px] select-none whitespace-nowrap border-r border-[var(--border)]/30 px-2 text-right text-[var(--muted-foreground)]/40 align-top">
              {pair.left?.oldLineNo ?? ''}
            </td>
            <td
              className={`w-1/2 whitespace-pre-wrap break-all border-r border-[var(--border)]/30 px-3 align-top ${
                pair.left?.type === 'removed'
                  ? 'bg-red-500/10 text-red-400'
                  : 'text-[var(--foreground)]'
              }`}
            >
              {pair.left?.content ?? '\u00A0'}
            </td>

            {/* Right side (new) */}
            <td className="w-[1px] select-none whitespace-nowrap px-2 text-right text-[var(--muted-foreground)]/40 align-top">
              {pair.right?.newLineNo ?? ''}
            </td>
            <td
              className={`w-1/2 whitespace-pre-wrap break-all px-3 align-top ${
                pair.right?.type === 'added'
                  ? 'bg-green-500/10 text-green-400'
                  : 'text-[var(--foreground)]'
              }`}
            >
              {pair.right?.content ?? '\u00A0'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
