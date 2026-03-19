'use client'

import { useProjectStore } from '@/stores/project.store'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function ProjectOverviewPage() {
  const params = useParams()
  const project = useProjectStore((s) => s.currentProject)
  const projectId = params.id as string

  if (!project) {
    return <div className="animate-pulse text-[var(--muted-foreground)]">Loading project...</div>
  }

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href={`/projects/${projectId}/chat`}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
        >
          <h3 className="font-medium">New Chat</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Start a conversation with Claude</p>
        </Link>
        <Link
          href={`/projects/${projectId}/git`}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
        >
          <h3 className="font-medium">Git</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">View status, branches, and commits</p>
        </Link>
        <Link
          href={`/projects/${projectId}/files`}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
        >
          <h3 className="font-medium">Files</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Browse and edit project files</p>
        </Link>
      </div>

      {/* Project info */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 font-medium">Project Details</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--muted-foreground)]">Permission Mode</dt>
            <dd className="rounded bg-[var(--secondary)] px-2 py-0.5 font-mono text-xs">{project.permissionMode}</dd>
          </div>
          {project.githubRepoFullName && (
            <div className="flex justify-between">
              <dt className="text-[var(--muted-foreground)]">GitHub Repo</dt>
              <dd className="font-mono text-xs">{project.githubRepoFullName}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-[var(--muted-foreground)]">Default Branch</dt>
            <dd className="font-mono text-xs">{project.defaultBranch}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted-foreground)]">Local Path</dt>
            <dd className="font-mono text-xs">{project.localPath}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
