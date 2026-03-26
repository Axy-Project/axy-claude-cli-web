'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useOrgStore } from '@/stores/org.store'
import { formatDate } from '@/lib/utils'
import type { OrgPlan } from '@axy/shared'

const planStyles: Record<OrgPlan, { bg: string; text: string }> = {
  free: { bg: 'bg-[var(--secondary)]', text: 'text-[var(--muted-foreground)]' },
  pro: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  enterprise: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
}

export default function OrgDashboardPage() {
  const params = useParams()
  const orgId = params.orgId as string
  const { currentOrg: org, members, isLoading, fetchOrg, fetchMembers } = useOrgStore()

  useEffect(() => {
    fetchOrg(orgId)
    fetchMembers(orgId)
  }, [orgId, fetchOrg, fetchMembers])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 animate-pulse rounded-lg bg-[var(--secondary)]" />
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-[var(--secondary)]" />
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--secondary)]" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]" />
          ))}
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 p-6 text-center">
        <h3 className="font-medium text-[var(--destructive)]">Organization not found</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          This organization may have been deleted or you don&apos;t have access.
        </p>
        <Link
          href="/org"
          className="mt-3 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Back to Organizations
        </Link>
      </div>
    )
  }

  const plan = planStyles[org.plan] || planStyles.free

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {org.avatarUrl ? (
            <img
              src={org.avatarUrl}
              alt={org.name}
              className="h-14 w-14 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--secondary)] text-2xl font-semibold">
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{org.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${plan.bg} ${plan.text}`}>
                {org.plan}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-sm text-[var(--muted-foreground)]">{org.slug}</p>
          </div>
        </div>
        <Link
          href={`/org/${orgId}/settings`}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--accent)]"
        >
          Settings
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--muted-foreground)]">Members</p>
          <p className="mt-1 text-2xl font-semibold">{members.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--muted-foreground)]">Plan</p>
          <p className="mt-1 text-2xl font-semibold capitalize">{org.plan}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--muted-foreground)]">Created</p>
          <p className="mt-1 text-lg font-semibold">{formatDate(org.createdAt)}</p>
        </div>
      </div>

      {/* Quick navigation */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href={`/org/${orgId}/members`}
          className="group rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--primary)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Members</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Manage team members and roles
              </p>
            </div>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
          {members.length > 0 && (
            <div className="mt-3 flex -space-x-2">
              {members.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--card)] bg-[var(--secondary)] text-xs font-medium"
                  title={m.user?.displayName || 'Member'}
                >
                  {m.user?.displayName?.charAt(0).toUpperCase() || '?'}
                </div>
              ))}
              {members.length > 5 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--card)] bg-[var(--secondary)] text-xs text-[var(--muted-foreground)]">
                  +{members.length - 5}
                </div>
              )}
            </div>
          )}
        </Link>

        <Link
          href={`/org/${orgId}/chat`}
          className="group rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--primary)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Team Chat</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Message your team in real-time
              </p>
            </div>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>

        <Link
          href={`/org/${orgId}/settings`}
          className="group rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--primary)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Settings</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Organization name, slug, and configuration
              </p>
            </div>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Recent members */}
      {members.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="font-medium">Team Members</h2>
            <Link
              href={`/org/${orgId}/members`}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--secondary)] text-sm font-medium">
                    {member.user?.displayName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.user?.displayName || 'Unknown User'}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{member.user?.email}</p>
                  </div>
                </div>
                <span className="rounded-full bg-[var(--secondary)] px-2.5 py-0.5 text-xs capitalize text-[var(--muted-foreground)]">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organization details */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 font-medium">Organization Details</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[var(--muted-foreground)]">ID</dt>
            <dd className="font-mono text-xs text-[var(--muted-foreground)]">{org.id}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--muted-foreground)]">Plan</dt>
            <dd>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${plan.bg} ${plan.text}`}>
                {org.plan}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--muted-foreground)]">Slug</dt>
            <dd className="font-mono text-xs">{org.slug}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--muted-foreground)]">Members</dt>
            <dd>{members.length}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--muted-foreground)]">Created</dt>
            <dd className="text-xs">{formatDate(org.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
