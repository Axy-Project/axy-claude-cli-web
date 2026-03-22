import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { ProjectRole } from '@axy/shared'

export interface ProjectAccess {
  role: ProjectRole
  canChat: boolean
  canEditFiles: boolean
  canManageGit: boolean
  canViewSettings: boolean
  canEditSettings: boolean
}

const ROLE_DEFAULTS: Record<ProjectRole, Omit<ProjectAccess, 'role'>> = {
  owner: { canChat: true, canEditFiles: true, canManageGit: true, canViewSettings: true, canEditSettings: true },
  editor: { canChat: true, canEditFiles: true, canManageGit: true, canViewSettings: true, canEditSettings: false },
  viewer: { canChat: true, canEditFiles: false, canManageGit: false, canViewSettings: false, canEditSettings: false },
}

export class ProjectMemberService {
  /** Check what access a user has to a project */
  async getAccess(projectId: string, userId: string): Promise<ProjectAccess | null> {
    // 1. Check if user is the project owner
    const [project] = await db.select({ userId: schema.projects.userId, orgId: schema.projects.orgId })
      .from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1)

    if (!project) return null
    if (project.userId === userId) return { role: 'owner', ...ROLE_DEFAULTS.owner }

    // 2. Check project_members table
    const [member] = await db.select().from(schema.projectMembers)
      .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)))
      .limit(1)

    if (member) {
      return {
        role: member.role as ProjectRole,
        canChat: member.canChat,
        canEditFiles: member.canEditFiles,
        canManageGit: member.canManageGit,
        canViewSettings: member.canViewSettings,
        canEditSettings: member.canEditSettings,
      }
    }

    // 3. Check org membership (org members get viewer access by default)
    if (project.orgId) {
      const [orgMember] = await db.select({ role: schema.orgMembers.role })
        .from(schema.orgMembers)
        .where(and(eq(schema.orgMembers.orgId, project.orgId), eq(schema.orgMembers.userId, userId)))
        .limit(1)

      if (orgMember) {
        const orgRole = orgMember.role as string
        if (orgRole === 'owner' || orgRole === 'admin') {
          return { role: 'editor', ...ROLE_DEFAULTS.editor }
        }
        return { role: 'viewer', ...ROLE_DEFAULTS.viewer }
      }
    }

    return null // No access
  }

  /** List all members of a project (with user info) */
  async listMembers(projectId: string) {
    const members = await db.select({
      id: schema.projectMembers.id,
      projectId: schema.projectMembers.projectId,
      userId: schema.projectMembers.userId,
      role: schema.projectMembers.role,
      canChat: schema.projectMembers.canChat,
      canEditFiles: schema.projectMembers.canEditFiles,
      canManageGit: schema.projectMembers.canManageGit,
      canViewSettings: schema.projectMembers.canViewSettings,
      canEditSettings: schema.projectMembers.canEditSettings,
      joinedAt: schema.projectMembers.joinedAt,
      userEmail: schema.users.email,
      userDisplayName: schema.users.displayName,
      userAvatarUrl: schema.users.avatarUrl,
      userGithubUsername: schema.users.githubUsername,
    })
      .from(schema.projectMembers)
      .innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
      .where(eq(schema.projectMembers.projectId, projectId))

    return members.map((m: any) => ({
      id: m.id,
      projectId: m.projectId,
      userId: m.userId,
      role: m.role,
      canChat: m.canChat,
      canEditFiles: m.canEditFiles,
      canManageGit: m.canManageGit,
      canViewSettings: m.canViewSettings,
      canEditSettings: m.canEditSettings,
      joinedAt: m.joinedAt,
      user: {
        id: m.userId,
        email: m.userEmail,
        displayName: m.userDisplayName,
        avatarUrl: m.userAvatarUrl,
        githubUsername: m.userGithubUsername,
      },
    }))
  }

  /** Add a member to a project */
  async addMember(projectId: string, userId: string, role: ProjectRole = 'viewer', permissions?: Partial<ProjectAccess>) {
    const defaults = ROLE_DEFAULTS[role]
    const [member] = await db.insert(schema.projectMembers).values({
      projectId,
      userId,
      role,
      canChat: permissions?.canChat ?? defaults.canChat,
      canEditFiles: permissions?.canEditFiles ?? defaults.canEditFiles,
      canManageGit: permissions?.canManageGit ?? defaults.canManageGit,
      canViewSettings: permissions?.canViewSettings ?? defaults.canViewSettings,
      canEditSettings: permissions?.canEditSettings ?? defaults.canEditSettings,
    }).returning()
    return member
  }

  /** Update a member's role and permissions */
  async updateMember(projectId: string, userId: string, data: { role?: ProjectRole } & Partial<ProjectAccess>) {
    const updates: Record<string, unknown> = {}
    if (data.role !== undefined) updates.role = data.role
    if (data.canChat !== undefined) updates.canChat = data.canChat
    if (data.canEditFiles !== undefined) updates.canEditFiles = data.canEditFiles
    if (data.canManageGit !== undefined) updates.canManageGit = data.canManageGit
    if (data.canViewSettings !== undefined) updates.canViewSettings = data.canViewSettings
    if (data.canEditSettings !== undefined) updates.canEditSettings = data.canEditSettings

    const [updated] = await db.update(schema.projectMembers)
      .set(updates)
      .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)))
      .returning()
    return updated || null
  }

  /** Remove a member from a project */
  async removeMember(projectId: string, userId: string) {
    await db.delete(schema.projectMembers)
      .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)))
  }
}

export const projectMemberService = new ProjectMemberService()
