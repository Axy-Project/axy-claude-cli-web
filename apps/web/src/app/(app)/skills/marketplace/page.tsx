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
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#bd9dff]">
            AVAILABLE CAPABILITIES
          </p>
          <h1 className="mt-2 font-headline text-4xl font-bold text-white">
            Expand your CLI intelligence.
          </h1>
          <p className="mt-2 max-w-lg text-sm text-[#adaaaa]">
            Browse and import pre-built skills to extend your projects with powerful automation,
            code review, testing, and deployment capabilities.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/skills"
            className="rounded-[0.5rem] border border-[rgba(72,72,71,0.4)] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-[#bd9dff]/40 hover:text-[#bd9dff]"
          >
            Browse Marketplace
          </Link>
          <Link
            href="/skills/new"
            className="rounded-[0.5rem] bg-gradient-to-r from-[#8b5cf6] to-[#bd9dff] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            New Skill
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767575]"
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
          className="w-full rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#767575] focus:border-[#bd9dff]/50"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[rgba(72,72,71,0.15)]">
        {ALL_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(c)}
            className={`relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
              categoryFilter === c
                ? 'text-white'
                : 'text-[#767575] hover:text-[#adaaaa]'
            }`}
          >
            {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
            {categoryFilter === c && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#bd9dff]" />
            )}
          </button>
        ))}

        {/* Source filter pill */}
        <div className="ml-auto shrink-0 pl-4">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-[0.5rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#adaaaa] outline-none transition-colors focus:border-[#bd9dff]/50"
          >
            {SOURCE_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Sources' : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      {!isCatalogLoading && (
        <p className="text-xs text-[#767575]">
          {filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Content */}
      {isCatalogLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#262626]" />
                <div className="h-4 w-32 rounded bg-[#262626]" />
              </div>
              <div className="mt-4 h-3 w-full rounded bg-[#262626]" />
              <div className="mt-2 h-3 w-2/3 rounded bg-[#262626]" />
              <div className="mt-4 h-16 rounded bg-[#0e0e0e]" />
            </div>
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="rounded-[0.75rem] border border-dashed border-[rgba(72,72,71,0.3)] p-16 text-center">
          <h3 className="font-headline text-lg font-medium text-white">No skills match your filters</h3>
          <p className="mt-2 text-sm text-[#767575]">
            Try adjusting your search or category selection
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => {
            const isImported = importedTriggers.has(skill.trigger)
            const isImporting = importingId === skill.id

            return (
              <div
                key={skill.id}
                className="group flex flex-col rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] p-5 transition-colors hover:border-[#bd9dff]/30"
              >
                {/* Card Header - Icon + Name */}
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#bd9dff]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                      <path
                        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-headline font-bold leading-tight text-white">
                      {skill.name}
                    </h3>
                    {skill.author && (
                      <p className="mt-0.5 text-[11px] text-[#767575]">by {skill.author}</p>
                    )}
                  </div>
                </div>

                {/* Category badges */}
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${categoryColor(skill.category)}`}
                  >
                    {skill.category}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                      skill.source === 'official'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-violet-500/15 text-violet-400'
                    }`}
                  >
                    {skill.source}
                  </span>
                </div>

                {/* Description */}
                <p className="mb-4 line-clamp-2 flex-1 text-sm leading-relaxed text-[#adaaaa]">
                  {skill.description}
                </p>

                {/* Code preview block */}
                <div className="mb-4 rounded-lg border border-[rgba(72,72,71,0.15)] bg-[#0e0e0e] p-3">
                  <code className="font-mono text-xs text-[#767575]">
                    <span className="text-[#bd9dff]">trigger:</span>{' '}
                    <span className="text-white">{skill.trigger}</span>
                  </code>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPreviewSkill(skill)}
                    className="text-sm font-medium text-[#bd9dff] transition-opacity hover:opacity-80"
                  >
                    Expand template &rarr;
                  </button>
                  <button
                    type="button"
                    disabled={isImporting || isImported}
                    onClick={() => handleImport(skill.id, skill.name)}
                    className={`rounded-[0.5rem] px-3.5 py-1.5 text-xs font-medium transition-all disabled:opacity-60 ${
                      isImported
                        ? 'border border-emerald-500/30 text-emerald-400'
                        : 'bg-gradient-to-r from-[#8b5cf6] to-[#bd9dff] text-white hover:opacity-90'
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
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[5vh] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewSkill(null)
          }}
        >
          <div className="w-full max-w-3xl rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#bd9dff]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path
                      d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="font-headline text-lg font-bold text-white">{previewSkill.name}</h2>
                  <p className="mt-1 text-sm text-[#adaaaa]">
                    {previewSkill.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewSkill(null)}
                className="shrink-0 rounded-lg p-1.5 text-[#767575] transition-colors hover:text-white"
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
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-[rgba(72,72,71,0.15)] bg-[#0e0e0e] px-2.5 py-1 font-mono text-xs text-white">
                {previewSkill.trigger}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${categoryColor(previewSkill.category)}`}>
                {previewSkill.category}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                  previewSkill.source === 'official'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-violet-500/15 text-violet-400'
                }`}
              >
                {previewSkill.source}
              </span>
              {previewSkill.author && (
                <span className="text-xs text-[#767575]">
                  by {previewSkill.author}
                </span>
              )}
            </div>

            {/* Prompt Template */}
            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#bd9dff]">
                Prompt Template
              </h3>
              <div className="max-h-[50vh] overflow-y-auto rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#0e0e0e] p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#adaaaa]">
                  {previewSkill.promptTemplate}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-[rgba(72,72,71,0.15)] pt-4">
              <button
                type="button"
                onClick={() => setPreviewSkill(null)}
                className="rounded-[0.5rem] border border-[rgba(72,72,71,0.4)] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-[#bd9dff]/40 hover:text-[#bd9dff]"
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
                className={`rounded-[0.5rem] px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60 ${
                  importedTriggers.has(previewSkill.trigger)
                    ? 'border border-emerald-500/30 text-emerald-400'
                    : 'bg-gradient-to-r from-[#8b5cf6] to-[#bd9dff] text-white hover:opacity-90'
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
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 rounded-[0.75rem] border border-[rgba(72,72,71,0.15)] bg-[#1a1a1a] px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
