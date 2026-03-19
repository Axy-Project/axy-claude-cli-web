'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface SlashCommandDef {
  name: string
  description: string
  category: 'session' | 'project' | 'claude' | 'agents' | 'custom'
  icon?: string
  requiresArgs?: boolean
  argHint?: string
}

// Built-in commands mirroring Claude Code's slash commands
const BUILT_IN_COMMANDS: SlashCommandDef[] = [
  // Session commands
  { name: 'compact', description: 'Compact conversation to free up context', category: 'session', argHint: '[focus instructions]' },
  { name: 'clear', description: 'Clear conversation history and start fresh', category: 'session' },
  { name: 'cost', description: 'Show token usage and cost statistics', category: 'session' },
  { name: 'context', description: 'Show current context usage', category: 'session' },
  { name: 'fork', description: 'Create a fork of the current conversation', category: 'session', argHint: '[name]' },
  { name: 'model', description: 'Switch the AI model', category: 'session', argHint: '[model-name]' },
  { name: 'plan', description: 'Enter plan mode (read-only analysis)', category: 'session' },

  // Project commands
  { name: 'init', description: 'Initialize project with CLAUDE.md guide', category: 'project' },
  { name: 'memory', description: 'Edit CLAUDE.md memory files', category: 'project' },
  { name: 'diff', description: 'Show uncommitted changes and per-turn diffs', category: 'project' },
  { name: 'task', description: 'Create a new background task', category: 'project', argHint: '<description>' },
  { name: 'tasks', description: 'List all tasks for this project', category: 'project' },
  { name: 'status', description: 'Show project and session status', category: 'project' },

  // Claude commands
  { name: 'review', description: 'Review a pull request for quality and security', category: 'claude', argHint: '[PR number]' },
  { name: 'security-review', description: 'Analyze changes for security vulnerabilities', category: 'claude' },
  { name: 'simplify', description: 'Review changed code for reuse, quality, efficiency', category: 'claude', argHint: '[focus area]' },
  { name: 'batch', description: 'Orchestrate large-scale changes in parallel', category: 'claude', requiresArgs: true, argHint: '<instruction>' },
  { name: 'release-notes', description: 'Generate release notes from changes', category: 'claude' },
  { name: 'pr-comments', description: 'Fetch and display PR comments', category: 'claude', argHint: '[PR]' },

  // Agent commands
  { name: 'agents', description: 'Show available agents and dashboard', category: 'agents' },
  { name: 'orchestrate', description: 'Auto-pick the best agent for your next message', category: 'agents' },
  { name: 'agent-review', description: 'Activate the Code Reviewer agent', category: 'agents' },
  { name: 'security', description: 'Activate the Security Analyst agent', category: 'agents' },
  { name: 'debug', description: 'Activate the Debugger agent', category: 'agents', argHint: '[description]' },
  { name: 'architect', description: 'Activate the Architect agent', category: 'agents' },
  { name: 'tdd', description: 'Activate the TDD Guide agent', category: 'agents' },
  { name: 'planner', description: 'Activate the Planner agent', category: 'agents' },
  { name: 'docs', description: 'Activate the Documentation Writer agent', category: 'agents' },
  { name: 'dismiss-agent', description: 'Dismiss the currently active agent', category: 'agents' },
]

const CATEGORY_LABELS: Record<string, string> = {
  session: 'Session',
  project: 'Project',
  claude: 'Claude',
  agents: 'Agents',
  custom: 'Custom Skills',
}

const CATEGORY_ORDER = ['session', 'project', 'claude', 'agents', 'custom']

interface SlashCommandMenuProps {
  query: string // text after the /
  customCommands?: SlashCommandDef[]
  onSelect: (command: SlashCommandDef) => void
  onClose: () => void
  visible: boolean
}

export function SlashCommandMenu({
  query,
  customCommands = [],
  onSelect,
  onClose,
  visible,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const allCommands = [...BUILT_IN_COMMANDS, ...customCommands]

  const filtered = query
    ? allCommands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, SlashCommandDef[]>>(
    (acc, cat) => {
      const items = filtered.filter((c) => c.category === cat)
      if (items.length > 0) acc[cat] = items
      return acc
    },
    {}
  )

  const flatFiltered = CATEGORY_ORDER.flatMap(
    (cat) => grouped[cat] || []
  )

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i > 0 ? i - 1 : flatFiltered.length - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i < flatFiltered.length - 1 ? i + 1 : 0))
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          if (flatFiltered[selectedIndex]) {
            onSelect(flatFiltered[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [visible, flatFiltered, selectedIndex, onSelect, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!visible || flatFiltered.length === 0) return null

  let flatIndex = 0

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-1 max-h-80 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl"
    >
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat]
        if (!items) return null

        return (
          <div key={cat}>
            <div className="sticky top-0 bg-[var(--card)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {CATEGORY_LABELS[cat]}
            </div>
            {items.map((cmd) => {
              const idx = flatIndex++
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={cmd.name}
                  ref={(el) => { itemRefs.current[idx] = el }}
                  onClick={() => onSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'text-[var(--foreground)] hover:bg-[var(--accent)]'
                  }`}
                >
                  <span className="shrink-0 font-mono text-sm font-semibold text-[var(--primary)]">
                    /{cmd.name}
                  </span>
                  {cmd.argHint && (
                    <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">
                      {cmd.argHint}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--muted-foreground)]">
                    {cmd.description}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export { BUILT_IN_COMMANDS }
