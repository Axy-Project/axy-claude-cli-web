'use client'

import { useEffect, useState, useMemo } from 'react'
import { useProjectStore } from '@/stores/project.store'
import { useOrgStore } from '@/stores/org.store'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import type { Project, Organization } from '@axy/shared'

/* ───────────────────────── Icons (inline SVGs) ───────────────────────── */

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

/* ───────────────────── Permission mode colors ────────────────────── */

const permissionColors: Record<string, string> = {
  default: 'bg-blue-500/15 text-blue-400',
  accept_edits: 'bg-amber-500/15 text-amber-400',
  plan: 'bg-emerald-500/15 text-emerald-400',
  bypass: 'bg-red-500/15 text-red-400',
}

const permissionLabels: Record<string, string> = {
  default: 'Default',
  accept_edits: 'Auto-edit',
  plan: 'Plan',
  bypass: 'Bypass',
}

/* ─────────────────────── Project Card ────────────────────────── */

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--primary)] hover:shadow-md hover:shadow-[var(--primary)]/5"
    >
      {/* Top: icon + name */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--primary)]">
          <FolderIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight text-[var(--foreground)]">
            {project.name}
          </h3>
          {project.description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-[var(--muted-foreground)]">
              {project.description}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-[var(--muted-foreground)]/50">
              No description
            </p>
          )}
        </div>
      </div>

      {/* Bottom: badges + date */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)]/50 pt-3">
        {project.githubRepoFullName && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--secondary)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
            <GitHubIcon />
            <span className="max-w-[140px] truncate">{project.githubRepoFullName}</span>
          </span>
        )}
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${permissionColors[project.permissionMode] || permissionColors.default}`}>
          {permissionLabels[project.permissionMode] || project.permissionMode}
        </span>
        {project.isArchived && (
          <span className="rounded-md bg-[var(--muted)]/30 px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
            Archived
          </span>
        )}
        <span className="ml-auto text-xs text-[var(--muted-foreground)]/70">
          {formatDate(project.updatedAt)}
        </span>
      </div>
    </Link>
  )
}

/* ───────────────── Collapsible Section ───────────────────── */

interface ProjectSectionProps {
  title: string
  icon: React.ReactNode
  avatarUrl?: string
  projects: Project[]
  newProjectHref: string
  defaultExpanded?: boolean
}

function ProjectSection({
  title,
  icon,
  avatarUrl,
  projects,
  newProjectHref,
  defaultExpanded = true,
}: ProjectSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]/30">
      {/* Section header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)]/50 px-5 py-3.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <ChevronDownIcon
            className={`shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 ${
              expanded ? '' : '-rotate-90'
            }`}
          />
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
              {icon}
            </span>
          )}
          <span className="text-sm font-semibold text-[var(--foreground)]">{title}</span>
          <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
            {projects.length}
          </span>
        </button>

        <Link
          href={newProjectHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <PlusIcon />
          New Project
        </Link>
      </div>

      {/* Section content */}
      {expanded && (
        <div className="p-5">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] py-10 text-center">
              <div className="mb-2 text-[var(--muted-foreground)]/50">
                <FolderIcon />
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">No projects yet</p>
              <Link
                href={newProjectHref}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                <PlusIcon />
                Create Project
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────── Main Page ───────────────────────── */

export default function ProjectsPage() {
  const { projects, fetchProjects, isLoading: projectsLoading } = useProjectStore()
  const { orgs, fetchOrgs, isLoading: orgsLoading } = useOrgStore()

  useEffect(() => {
    fetchProjects()
    fetchOrgs()
  }, [fetchProjects, fetchOrgs])

  const isLoading = projectsLoading || orgsLoading

  // Group projects: personal vs per-org
  const { personalProjects, orgSections } = useMemo(() => {
    const personal: Project[] = []
    const byOrg: Record<string, Project[]> = {}

    for (const project of projects) {
      if (!project.orgId) {
        personal.push(project)
      } else {
        if (!byOrg[project.orgId]) byOrg[project.orgId] = []
        byOrg[project.orgId].push(project)
      }
    }

    // Build org sections in the same order as the orgs array
    const sections: { org: Organization; projects: Project[] }[] = []
    for (const org of orgs) {
      sections.push({
        org,
        projects: byOrg[org.id] || [],
      })
    }

    // Also include any orgIds that are in projects but not in orgs (edge case)
    const knownOrgIds = new Set(orgs.map((o) => o.id))
    for (const [orgId, orgProjects] of Object.entries(byOrg)) {
      if (!knownOrgIds.has(orgId)) {
        sections.push({
          org: { id: orgId, name: 'Unknown Organization', slug: '', plan: 'free' as never, settingsJson: {}, createdAt: '' },
          projects: orgProjects,
        })
      }
    }

    return { personalProjects: personal, orgSections: sections }
  }, [projects, orgs])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {projects.length} project{projects.length !== 1 ? 's' : ''} across{' '}
              {orgSections.filter((s) => s.projects.length > 0).length + (personalProjects.length > 0 ? 1 : 0)}{' '}
              workspace{(orgSections.filter((s) => s.projects.length > 0).length + (personalProjects.length > 0 ? 1 : 0)) !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon />
          New Project
        </Link>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card)]/30 p-5"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-[var(--secondary)]" />
                <div className="h-4 w-32 rounded bg-[var(--secondary)]" />
                <div className="h-5 w-8 rounded-full bg-[var(--secondary)]" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-32 rounded-xl bg-[var(--secondary)]/50" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 && orgs.length === 0 ? (
        /* Global empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <div className="mb-3 text-[var(--muted-foreground)]/40">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium">No projects yet</h3>
          <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">
            Create a project to start using Claude CLI remotely. Projects can be personal or belong to an organization.
          </p>
          <Link
            href="/projects/new"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <PlusIcon />
            Create Your First Project
          </Link>
        </div>
      ) : (
        /* Sections */
        <div className="space-y-5">
          {/* Personal Projects */}
          <ProjectSection
            title="Personal Projects"
            icon={<UserIcon />}
            projects={personalProjects}
            newProjectHref="/projects/new"
            defaultExpanded
          />

          {/* Organization Sections */}
          {orgSections.map((section) => (
            <ProjectSection
              key={section.org.id}
              title={section.org.name}
              icon={<BuildingIcon />}
              avatarUrl={section.org.avatarUrl}
              projects={section.projects}
              newProjectHref={`/projects/new?orgId=${section.org.id}`}
              defaultExpanded
            />
          ))}
        </div>
      )}
    </div>
  )
}
