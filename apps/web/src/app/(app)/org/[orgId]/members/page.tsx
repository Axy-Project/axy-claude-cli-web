'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useOrgStore } from '@/stores/org.store'
import { formatDate } from '@/lib/utils'
import { api } from '@/lib/api-client'
import type { OrgRole, OrgMember } from '@axy/shared'
import { ORG_ROLES } from '@axy/shared'

const roleColors: Record<OrgRole, { bg: string; text: string }> = {
  owner: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  admin: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  member: { bg: 'bg-green-500/15', text: 'text-green-400' },
  viewer: { bg: 'bg-[var(--secondary)]', text: 'text-[var(--muted-foreground)]' },
}

export default function OrgMembersPage() {
  const params = useParams()
  const orgId = params.orgId as string
  const { currentOrg: org, members, fetchOrg, fetchMembers, addMember, removeMember } = useOrgStore()

  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [userIdInput, setUserIdInput] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('member')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchOrg(orgId), fetchMembers(orgId)]).finally(() =>
      setIsLoadingPage(false)
    )
  }, [orgId, fetchOrg, fetchMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const input = userIdInput.trim()
    if (!input) return

    setIsInviting(true)
    setInviteError(null)
    try {
      // Detect if input is email or github username
      const body = input.includes('@')
        ? { email: input, role: inviteRole }
        : { githubUsername: input.replace(/^@/, ''), role: inviteRole }
      await addMember(orgId, body)
      setUserIdInput('')
      setInviteRole('member')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemove = async (member: OrgMember) => {
    const name = member.user?.displayName || member.userId
    if (!confirm(`Remove ${name} from this organization?`)) return

    setRemovingId(member.userId)
    try {
      await removeMember(orgId, member.userId)
    } catch (err) {
      console.error('Remove member error:', err)
    } finally {
      setRemovingId(null)
    }
  }

  const handleRoleChange = async (member: OrgMember, newRole: OrgRole) => {
    if (newRole === member.role) return
    setChangingRoleId(member.id)
    try {
      await api.put(`/api/orgs/${orgId}/members/${member.userId}`, { role: newRole })
      await fetchMembers(orgId)
    } catch (err) {
      console.error('Change role error:', err)
    } finally {
      setChangingRoleId(null)
    }
  }

  if (isLoadingPage) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-32 animate-pulse rounded bg-[var(--secondary)]" />
        <div className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & header */}
      <div>
        <Link
          href={`/org/${orgId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {org?.name || 'Organization'}
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Members</h1>
          <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-sm text-[var(--muted-foreground)]">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Add member form */}
      <form
        onSubmit={handleInvite}
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
      >
        <h3 className="mb-3 font-medium">Add Member</h3>
        {inviteError && (
          <div className="mb-3 rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            {inviteError}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={userIdInput}
            onChange={(e) => {
              setUserIdInput(e.target.value)
              setInviteError(null)
            }}
            placeholder="Email or @github username"
            className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as OrgRole)}
            className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
          >
            {ORG_ROLES.filter((r) => r !== 'owner').map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isInviting || !userIdInput.trim()}
            className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isInviting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Adding...
              </span>
            ) : (
              'Add Member'
            )}
          </button>
        </div>
      </form>

      {/* Members list */}
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 text-[var(--muted-foreground)]"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
          </svg>
          <h3 className="font-medium">No members yet</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Add team members above to start collaborating.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Member
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Joined
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {members.map((member) => {
                const colors = roleColors[member.role] || roleColors.viewer
                return (
                  <tr key={member.id} className="bg-[var(--card)] transition-colors hover:bg-[var(--accent)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {member.user?.avatarUrl ? (
                          <img src={member.user.avatarUrl} alt="" className="h-9 w-9 rounded-full" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--secondary)] text-sm font-medium">
                            {member.user?.displayName?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {member.user?.displayName || 'Unknown User'}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {(member.user as any)?.githubUsername && <span className="mr-2">@{(member.user as any).githubUsername}</span>}
                            {member.user?.email || member.userId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {member.role === 'owner' ? (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors.bg} ${colors.text}`}>
                          {member.role}
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member, e.target.value as OrgRole)}
                          disabled={changingRoleId === member.id}
                          className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium capitalize outline-none ${colors.bg} ${colors.text} cursor-pointer disabled:cursor-wait disabled:opacity-50`}
                        >
                          {ORG_ROLES.filter((r) => r !== 'owner').map((role) => (
                            <option key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                      {formatDate(member.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemove(member)}
                          disabled={removingId === member.userId}
                          className="rounded-lg px-3 py-1.5 text-xs text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10 disabled:cursor-wait disabled:opacity-50"
                        >
                          {removingId === member.userId ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
