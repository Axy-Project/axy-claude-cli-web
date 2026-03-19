'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSkillStore, type CatalogSkill } from '@/stores/skill.store'
import Link from 'next/link'

const ALL_CATEGORIES = [
  'all',
  'code',
  'review',
  'testing',
  'docs',
  'git',
  'security',
  'deploy',
] as const

const SOURCE_FILTERS = ['all', 'official', 'community'] as const

const CATEGORY_COLORS: Record<string, string> = {
  code: 'bg-blue-500/15 text-blue-400',
  review: 'bg-amber-500/15 text-amber-400',
  testing: 'bg-green-500/15 text-green-400',
  docs: 'bg-purple-500/15 text-purple-400',
  git: 'bg-orange-500/15 text-orange-400',
  security: 'bg-red-500/15 text-red-400',
  deploy: 'bg-cyan-500/15 text-cyan-400',
  general: 'bg-gray-500/15 text-gray-400',
}

function categoryColor(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.general
}

export default function SkillsMarketplacePage() {
  const { catalogSkills, isCatalogLoading, fetchCatalog, importSkill, skills, fetchSkills } =
    useSkillStore()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [previewSkill, setPreviewSkill] = useState<CatalogSkill | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetchCatalog()
    fetchSkills()
  }, [fetchCatalog, fetchSkills])

  // Track which catalog skills are already imported (by trigger match)
  const importedTriggers = useMemo(() => {
    const triggers = new Set<string>()
    for (const s of skills) {
      if (s.trigger) triggers.add(s.trigger)
    }
    return triggers
  }, [skills])

  const filteredSkills = useMemo(() => {
    return catalogSkills.filter((skill) => {
      if (categoryFilter !== 'all' && skill.category !== categoryFilter) return false
      if (sourceFilter !== 'all' && skill.source !== sourceFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          skill.name.toLowerCase().includes(q) ||
          skill.description.toLowerCase().includes(q) ||
          skill.trigger.toLowerCase().includes(q) ||
          skill.category.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [catalogSkills, categoryFilter, sourceFilter, search])

  const handleImport = useCallback(
    async (catalogId: string, skillName: string) => {
      setImportingId(catalogId)
      try {
        await importSkill(catalogId)
        setToast(`"${skillName}" imported successfully`)
        setTimeout(() => setToast(null), 3000)
      } catch (err) {
        console.error('Failed to import skill:', err)
        setToast(`Failed to import "${skillName}"`)
        setTimeout(() => setToast(null), 3000)
      } finally {
        setImportingId(null)
      }
    },
    [importSkill]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/skills"
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M12.5 15L7.5 10L12.5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Skills Marketplace</h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Browse and import pre-built skills for your projects
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M7.333 12.667A5.333 5.333 0 107.333 2a5.333 5.333 0 000 10.667zM14 14l-2.9-2.9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills by name, trigger, or description..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
        >
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
        >
          {SOURCE_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Sources' : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {!isCatalogLoading && (
        <p className="text-sm text-[var(--muted-foreground)]">
          {filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Content */}
      {isCatalogLoading ? (
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading catalog...</div>
      ) : filteredSkills.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <h3 className="text-lg font-medium">No skills match your filters</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => {
            const isImported = importedTriggers.has(skill.trigger)
            const isImporting = importingId === skill.id

            return (
              <div
                key={skill.id}
                className="group flex flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
              >
                {/* Card Header */}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-medium leading-tight">{skill.name}</h3>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded px-2 py-0.5 text-xs ${categoryColor(skill.category)}`}>
                      {skill.category}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        skill.source === 'official'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-violet-500/15 text-violet-400'
                      }`}
                    >
                      {skill.source}
                    </span>
                  </div>
                </div>

                {/* Trigger */}
                <div className="mb-2">
                  <span className="inline-block rounded bg-[var(--accent)] px-2 py-0.5 font-mono text-xs text-[var(--foreground)]">
                    {skill.trigger}
                  </span>
                </div>

                {/* Description */}
                <p className="mb-4 line-clamp-2 flex-1 text-sm text-[var(--muted-foreground)]">
                  {skill.description}
                </p>

                {/* Author */}
                {skill.author && (
                  <p className="mb-3 text-xs text-[var(--muted-foreground)]">
                    by {skill.author}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
                  <button
                    type="button"
                    onClick={() => setPreviewSkill(skill)}
                    className="flex-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    disabled={isImporting || isImported}
                    onClick={() => handleImport(skill.id, skill.name)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-50 ${
                      isImported
                        ? 'border border-emerald-500/30 text-emerald-400'
                        : 'bg-[var(--primary)] text-white hover:opacity-90'
                    }`}
                  >
                    {isImporting ? 'Importing...' : isImported ? 'Imported' : 'Import'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewSkill && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[5vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewSkill(null)
          }}
        >
          <div className="w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{previewSkill.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {previewSkill.description}
                </p>
              </div>
              <button
                onClick={() => setPreviewSkill(null)}
                className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Meta info */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-block rounded bg-[var(--accent)] px-2 py-0.5 font-mono text-xs text-[var(--foreground)]">
                {previewSkill.trigger}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs ${categoryColor(previewSkill.category)}`}>
                {previewSkill.category}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  previewSkill.source === 'official'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-violet-500/15 text-violet-400'
                }`}
              >
                {previewSkill.source}
              </span>
              {previewSkill.author && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  by {previewSkill.author}
                </span>
              )}
            </div>

            {/* Prompt Template */}
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">
                Prompt Template
              </h3>
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--foreground)]">
                  {previewSkill.promptTemplate}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setPreviewSkill(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={importingId === previewSkill.id || importedTriggers.has(previewSkill.trigger)}
                onClick={() => {
                  handleImport(previewSkill.id, previewSkill.name)
                  setPreviewSkill(null)
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${
                  importedTriggers.has(previewSkill.trigger)
                    ? 'border border-emerald-500/30 text-emerald-400'
                    : 'bg-[var(--primary)] text-white hover:opacity-90'
                }`}
              >
                {importedTriggers.has(previewSkill.trigger) ? 'Already Imported' : 'Import Skill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
