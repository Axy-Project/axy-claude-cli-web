'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrgStore } from '@/stores/org.store'

export default function NewOrganizationPage() {
  const router = useRouter()
  const createOrg = useOrgStore((s) => s.createOrg)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [slugTouched, setSlugTouched] = useState(false)

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const handleNameChange = (name: string) => {
    setForm({
      name,
      slug: slugTouched ? form.slug : generateSlug(name),
    })
    setError(null)
  }

  const handleSlugChange = (slug: string) => {
    setSlugTouched(true)
    setForm({ ...form, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '') })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    const slug = form.slug.trim()
    if (!name || !slug) return

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
      setError('Slug must start and end with a letter or number')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const org = await createOrg({ name, slug })
      router.push(`/org/${org.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/org"
          className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to organizations
        </Link>
        <h1 className="text-2xl font-bold">Create Organization</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Set up a new workspace for your team to collaborate on projects.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Organization Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="My Team"
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">URL Slug</label>
          <div className="flex items-center gap-0">
            <span className="rounded-l-lg border border-r-0 border-[var(--input)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              /org/
            </span>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="my-team"
              className="w-full rounded-r-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              required
            />
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            Only lowercase letters, numbers, and hyphens. Auto-generated from name.
          </p>
        </div>

        <div className="flex gap-3 border-t border-[var(--border)] pt-5">
          <button
            type="submit"
            disabled={isSubmitting || !form.name.trim() || !form.slug.trim()}
            className="rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </span>
            ) : (
              'Create Organization'
            )}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-[var(--border)] px-6 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
