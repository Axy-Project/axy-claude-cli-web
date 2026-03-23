'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrgStore } from '@/stores/org.store'
import type { OrgPlan } from '@axy/shared'

const planInfo: Record<OrgPlan, { label: string; description: string; color: string }> = {
  free: {
    label: 'Free',
    description: 'Basic features for small teams',
    color: 'text-[var(--muted-foreground)] bg-[var(--secondary)]',
  },
  pro: {
    label: 'Pro',
    description: 'Advanced features and priority support',
    color: 'text-blue-400 bg-blue-500/15',
  },
  enterprise: {
    label: 'Enterprise',
    description: 'Custom solutions with dedicated support',
    color: 'text-purple-400 bg-purple-500/15',
  },
}

export default function OrgSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { currentOrg: org, isLoading, fetchOrg, updateOrg, deleteOrg } = useOrgStore()

  const [form, setForm] = useState({ name: '', slug: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchOrg(orgId)
  }, [orgId, fetchOrg])

  useEffect(() => {
    if (org) {
      setForm({ name: org.name, slug: org.slug })
    }
  }, [org])

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
      await updateOrg(orgId, { name, slug })
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== org?.name) return

    setIsDeleting(true)
    try {
      await deleteOrg(orgId)
      router.push('/org')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-7 w-48 animate-pulse rounded bg-[var(--secondary)]" />
        <div className="h-64 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]" />
        <div className="h-40 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 p-6 text-center">
        <h3 className="font-medium text-[var(--destructive)]">Organization not found</h3>
        <Link
          href="/org"
          className="mt-3 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Back to Organizations
        </Link>
      </div>
    )
  }

  const plan = planInfo[org.plan] || planInfo.free
  const hasChanges = form.name !== org.name || form.slug !== org.slug

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb & header */}
      <div>
        <Link
          href={`/org/${orgId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {org.name}
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      )}

      {/* Organization Avatar */}
      <div className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-6 py-4">
        <div className="relative">
          {org?.avatarUrl ? (
            <img src={org.avatarUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--primary)]/20 text-2xl font-bold text-[var(--primary)]">
              {org?.name?.[0]?.toUpperCase() || 'O'}
            </div>
          )}
          <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[var(--primary)] text-white shadow hover:opacity-90">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const formData = new FormData()
              formData.append('avatar', file)
              const token = localStorage.getItem('axy_token')
              const apiUrl = (typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80' || window.location.port === '443')) ? `${window.location.protocol}//${window.location.hostname}` : `${window.location.protocol}//${window.location.hostname}:3456`
              const res = await fetch(`${apiUrl}/api/orgs/${orgId}/avatar`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
              })
              if (res.ok) window.location.reload()
            }} />
          </label>
        </div>
        <div>
          <h3 className="font-medium">{org?.name}</h3>
          <p className="text-xs text-[var(--muted-foreground)]">Click the + to upload an organization logo</p>
        </div>
      </div>

      {/* General settings */}
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-[var(--border)] bg-[var(--card)]"
      >
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="font-medium">General</h2>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            Basic organization information
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Organization Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value })
                setError(null)
              }}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              required
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
                onChange={(e) => {
                  setForm({
                    ...form,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                  setError(null)
                }}
                className="w-full rounded-r-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              Only lowercase letters, numbers, and hyphens.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="submit"
            disabled={isSubmitting || !form.name.trim() || !form.slug.trim() || !hasChanges}
            className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </span>
            ) : isSaved ? (
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Saved
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
          {hasChanges && (
            <button
              type="button"
              onClick={() => setForm({ name: org.name, slug: org.slug })}
              className="rounded-lg px-4 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* Plan info */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="font-medium">Plan</h2>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            Your current subscription plan
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${plan.color}`}>
                {plan.label}
              </span>
              <span className="text-sm text-[var(--muted-foreground)]">{plan.description}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            Contact support to upgrade or change your plan.
          </p>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-[var(--destructive)]/50 bg-[var(--card)]">
        <div className="border-b border-[var(--destructive)]/30 px-6 py-4">
          <h2 className="font-medium text-[var(--destructive)]">Danger Zone</h2>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            Irreversible and destructive actions
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="rounded-lg border border-[var(--destructive)]/30 p-4">
            <h3 className="text-sm font-medium">Delete this organization</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Once deleted, all data associated with this organization will be permanently removed.
              This includes all members, projects, and settings. This action cannot be undone.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs text-[var(--muted-foreground)]">
                  Type <span className="font-mono font-semibold text-[var(--foreground)]">{org.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={org.name}
                  className="w-full max-w-sm rounded-lg border border-[var(--destructive)]/30 bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--destructive)] focus:ring-1 focus:ring-[var(--destructive)]"
                />
              </div>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== org.name || isDeleting}
                className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </span>
                ) : (
                  'Delete Organization'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
