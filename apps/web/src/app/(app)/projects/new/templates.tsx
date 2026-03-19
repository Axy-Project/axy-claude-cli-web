'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'

interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: string
  setupCommands: string[]
  claudeMd: string
  files: Record<string, string>
}

interface TemplatePickerProps {
  onSelect: (templateId: string) => void
  selectedId?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  frontend: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  backend: 'bg-green-500/15 text-green-400 border-green-500/30',
  fullstack: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  data: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  mobile: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
}

const ICON_COLORS: Record<string, string> = {
  TS: 'bg-blue-600 text-white',
  NX: 'bg-black text-white',
  PY: 'bg-yellow-500 text-black',
  RS: 'bg-orange-600 text-white',
  EX: 'bg-gray-600 text-white',
  RE: 'bg-cyan-500 text-white',
  ML: 'bg-violet-600 text-white',
}

export function TemplatePicker({ onSelect, selectedId }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const data = await api.get<ProjectTemplate[]>('/api/templates')
        setTemplates(data)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        <span className="ml-2 text-sm text-[var(--muted-foreground)]">Loading templates...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
        Failed to load templates: {error}
      </div>
    )
  }

  const categories = Array.from(new Set(templates.map((t) => t.category)))
  const filtered = filterCategory
    ? templates.filter((t) => t.category === filterCategory)
    : templates

  return (
    <div className="space-y-3">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCategory(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            filterCategory === null
              ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat === filterCategory ? null : cat)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filterCategory === cat
                ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((template) => {
          const isSelected = selectedId === template.id
          const categoryStyle = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.backend
          const iconStyle = ICON_COLORS[template.icon] || 'bg-gray-500 text-white'

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(isSelected ? '' : template.id)}
              className={`group relative flex flex-col rounded-lg border p-4 text-left transition-all ${
                isSelected
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 hover:bg-[var(--accent)]/50'
              }`}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${iconStyle}`}
                >
                  {template.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {template.name}
                    </span>
                  </div>
                  <span
                    className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${categoryStyle}`}
                  >
                    {template.category}
                  </span>
                </div>
                {isSelected && (
                  <svg
                    className="h-5 w-5 shrink-0 text-[var(--primary)]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>

              {/* Description */}
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {template.description}
              </p>

              {/* Footer - setup info */}
              <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
                {Object.keys(template.files).length > 0 && (
                  <span>{Object.keys(template.files).length} starter files</span>
                )}
                {template.setupCommands.length > 0 && (
                  <span>{template.setupCommands.length} setup commands</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
          No templates in this category.
        </p>
      )}
    </div>
  )
}
