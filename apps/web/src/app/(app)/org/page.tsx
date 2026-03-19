'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import type { Organization } from '@axy/shared'

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<Organization[]>('/api/orgs')
      .then(setOrgs)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Link
          href="/org/new"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          New Organization
        </Link>
      </div>

      {isLoading ? (
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading organizations...</div>
      ) : orgs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <h3 className="text-lg font-medium">No organizations yet</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Create an organization to collaborate with your team
          </p>
          <Link
            href="/org/new"
            className="mt-4 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Create Organization
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/org/${org.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
            >
              <div className="flex items-center gap-3">
                {org.avatarUrl ? (
                  <img
                    src={org.avatarUrl}
                    alt={org.name}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)] text-lg font-medium">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-medium">{org.name}</h3>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">
                      {org.slug}
                    </span>
                    <span className="rounded bg-[var(--secondary)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                      {org.plan}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatDate(org.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
