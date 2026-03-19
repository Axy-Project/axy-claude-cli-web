'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSkillStore } from '@/stores/skill.store'
import { useProjectStore } from '@/stores/project.store'
import { formatDate } from '@/lib/utils'
import type { Skill, CreateSkillInput } from '@axy/shared'

const CATEGORIES = ['general', 'code', 'review', 'deploy', 'testing', 'docs'] as const

const EMPTY_FORM: CreateSkillInput = {
  name: '',
  description: '',
  trigger: '',
  promptTemplate: '',
  category: 'general',
  allowedToolsJson: [],
  isGlobal: false,
}

function highlightTemplate(text: string) {
  const parts = text.split(/({{[\w.]+}})/)
  return parts.map((part, i) =>
    /^{{[\w.]+}}$/.test(part) ? (
      <span key={i} className="rounded bg-[var(--primary)]/20 px-1 text-[var(--primary)]">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default function ProjectSkillsPage() {
  const params = useParams()
  const projectId = params.id as string
  const project = useProjectStore((s) => s.currentProject)
  const { skills, fetchSkills, createSkill, updateSkill, deleteSkill, isLoading } = useSkillStore()

  const [showForm, setShowForm] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [form, setForm] = useState<CreateSkillInput>(EMPTY_FORM)
  const [allowedToolsText, setAllowedToolsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const projectSkills = skills.filter(
    (s: Skill) => s.isGlobal || s.orgId === project?.orgId
  )

  const openCreate = useCallback(() => {
    setEditingSkill(null)
    setForm({ ...EMPTY_FORM, orgId: project?.orgId })
    setAllowedToolsText('')
    setShowForm(true)
  }, [project?.orgId])

  const openEdit = useCallback((skill: Skill) => {
    setEditingSkill(skill)
    setForm({
      name: skill.name,
      description: skill.description,
      trigger: skill.trigger || '',
      promptTemplate: skill.promptTemplate,
      category: skill.category,
      allowedToolsJson: skill.allowedToolsJson || [],
      isGlobal: skill.isGlobal,
      orgId: skill.orgId,
    })
    setAllowedToolsText((skill.allowedToolsJson || []).join(', '))
    setShowForm(true)
  }, [])

  const closeForm = useCallback(() => {
    setShowForm(false)
    setEditingSkill(null)
    setForm(EMPTY_FORM)
    setAllowedToolsText('')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: CreateSkillInput = {
        ...form,
        trigger: form.trigger || undefined,
        allowedToolsJson: allowedToolsText
          ? allowedToolsText.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
        orgId: form.orgId || project?.orgId,
      }
      if (editingSkill) {
        await updateSkill(editingSkill.id, payload)
      } else {
        await createSkill(payload)
      }
      closeForm()
    } catch (err) {
      console.error('Failed to save skill:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this skill? This action cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSkill(id)
    } catch (err) {
      console.error('Failed to delete skill:', err)
    } finally {
      setDeletingId(null)
    }
  }

  // Check if the current user owns the skill (non-global skills can be edited)
  const canEdit = (skill: Skill) => !skill.isGlobal || skill.orgId === project?.orgId

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Skills</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Reusable prompt templates for this project
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/skills/marketplace"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
          >
            Browse Marketplace
          </Link>
          <button
            onClick={openCreate}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            New Skill
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[5vh]">
          <div className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingSkill ? 'Edit Skill' : 'Create Skill'}
              </h2>
              <button
                onClick={closeForm}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Code Review"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <input
                  type="text"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of what this skill does"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                />
              </div>

              {/* Trigger & Category row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Trigger (slash command)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">/</span>
                    <input
                      type="text"
                      value={(form.trigger || '').replace(/^\//, '')}
                      onChange={(e) => setForm({ ...form, trigger: '/' + e.target.value.replace(/^\//, '') })}
                      placeholder="review"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-7 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prompt Template */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Prompt Template
                </label>
                <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                  Use {'{{variable}}'} syntax for dynamic values. e.g. {'{{file}}'}, {'{{language}}'}, {'{{context}}'}
                </p>
                <textarea
                  required
                  rows={8}
                  value={form.promptTemplate}
                  onChange={(e) => setForm({ ...form, promptTemplate: e.target.value })}
                  placeholder={'Review the following {{language}} code:\n\n{{code}}\n\nFocus on:\n- Code quality\n- Performance\n- Security'}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-[var(--primary)]"
                />
              </div>

              {/* Allowed Tools */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Allowed Tools</label>
                <input
                  type="text"
                  value={allowedToolsText}
                  onChange={(e) => setAllowedToolsText(e.target.value)}
                  placeholder="read, write, bash (comma-separated)"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                />
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Comma-separated list of tool names this skill can use
                </p>
              </div>

              {/* Global Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isGlobal}
                  onClick={() => setForm({ ...form, isGlobal: !form.isGlobal })}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    form.isGlobal ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      form.isGlobal ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <span className="text-sm font-medium">Global Skill</span>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Available to all projects and users
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingSkill ? 'Update Skill' : 'Create Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading skills...</div>
      ) : projectSkills.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
          <h3 className="text-lg font-medium">No skills available</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Create a skill or import one from the marketplace
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href="/skills/marketplace"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
            >
              Browse Marketplace
            </Link>
            <button
              onClick={openCreate}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
            >
              Create Skill
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {projectSkills.map((skill) => (
            <div
              key={skill.id}
              className="group rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {/* Name row */}
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{skill.name}</h3>
                    {skill.trigger && (
                      <span className="inline-block rounded bg-[var(--accent)] px-2 py-0.5 font-mono text-xs text-[var(--foreground)]">
                        {skill.trigger}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {skill.description}
                  </p>

                  {/* Template Preview */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                    className="mt-2 w-full text-left"
                  >
                    <div
                      className={`rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-xs leading-relaxed text-[var(--muted-foreground)] ${
                        expandedId === skill.id ? '' : 'line-clamp-2'
                      }`}
                    >
                      {highlightTemplate(skill.promptTemplate)}
                    </div>
                    <span className="mt-1 inline-block text-xs text-[var(--muted-foreground)] underline decoration-dotted">
                      {expandedId === skill.id ? 'Collapse' : 'Expand template'}
                    </span>
                  </button>

                  {/* Meta row */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded bg-[var(--secondary)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                      {skill.category}
                    </span>
                    {skill.isGlobal && (
                      <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-500">
                        Global
                      </span>
                    )}
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(skill.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {canEdit(skill) && (
                  <div className="ml-4 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(skill)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(skill.id)}
                      disabled={deletingId === skill.id}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingId === skill.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
