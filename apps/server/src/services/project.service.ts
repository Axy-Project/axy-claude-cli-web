import { eq, and, desc, like, or, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs/promises'
import simpleGit from 'simple-git'
import { db, schema } from '../db/index.js'
import { config } from '../config.js'
import type { CreateProjectInput, ProjectFilters } from '@axy/shared'
import { projectMemberService } from './project-member.service.js'

export class ProjectService {
  async list(userId: string, filters: ProjectFilters = {}) {
    const { page = 1, pageSize = 20, orgId, isArchived, search } = filters

    // Get projects the user owns
    const owned = await db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.userId, userId),
          orgId ? eq(schema.projects.orgId, orgId) : undefined,
          isArchived !== undefined ? eq(schema.projects.isArchived, isArchived) : eq(schema.projects.isArchived, false),
          search ? or(
            like(schema.projects.name, `%${search}%`),
            like(schema.projects.description, `%${search}%`)
          ) : undefined,
        )
      )
      .orderBy(desc(schema.projects.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    // Get projects where user is a member (not owner)
    const memberships = await db.select({ projectId: schema.projectMembers.projectId })
      .from(schema.projectMembers)
      .where(eq(schema.projectMembers.userId, userId))

    const memberProjectIds = memberships.map((m: { projectId: string }) => m.projectId).filter((id: string) => !owned.some((p: { id: string }) => p.id === id))

    let shared: typeof owned = []
    if (memberProjectIds.length > 0) {
      shared = await db.select().from(schema.projects)
        .where(and(
          inArray(schema.projects.id, memberProjectIds),
          isArchived !== undefined ? eq(schema.projects.isArchived, isArchived) : eq(schema.projects.isArchived, false),
        ))
        .orderBy(desc(schema.projects.updatedAt))
    }

    return [...owned, ...shared]
  }

  /** Get project by ID — owner OR member with access */
  async getById(projectId: string, userId: string) {
    // First try direct ownership
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) return null

    // Owner always has access
    if (project.userId === userId) return project

    // Check member access
    const access = await projectMemberService.getAccess(projectId, userId)
    if (access) return project

    return null
  }

  async create(userId: string, input: CreateProjectInput) {
    const projectId = uuid()
    const localPath = path.resolve(config.projectsDir, userId, projectId)

    // Create project directory and init git repo
    await fs.mkdir(localPath, { recursive: true })
    await simpleGit(localPath).init()

    // Extract owner/repo from GitHub URL if present
    let githubRepoFullName: string | undefined
    if (input.githubRepoUrl) {
      const match = input.githubRepoUrl.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)
      if (match) githubRepoFullName = match[1]
    }

    const [project] = await db
      .insert(schema.projects)
      .values({
        id: projectId,
        userId,
        orgId: input.orgId,
        name: input.name,
        description: input.description,
        localPath,
        githubRepoUrl: input.githubRepoUrl,
        githubRepoFullName,
        permissionMode: input.permissionMode || 'default',
      })
      .returning()

    return project
  }

  async update(projectId: string, userId: string, data: Partial<CreateProjectInput>) {
    const [project] = await db
      .update(schema.projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, userId)
      ))
      .returning()
    return project || null
  }

  async delete(projectId: string, userId: string) {
    const project = await this.getById(projectId, userId)
    if (!project) return false

    // Only delete directory if it's inside the managed projectsDir
    const resolvedProjectsDir = path.resolve(config.projectsDir)
    const resolvedLocalPath = path.resolve(project.localPath)
    if (resolvedLocalPath.startsWith(resolvedProjectsDir + path.sep)) {
      try {
        await fs.rm(resolvedLocalPath, { recursive: true, force: true })
      } catch { /* directory might not exist */ }
    }

    // Delete dependent records (cascade manually for SQLite)
    // 1. Get session IDs for this project
    const sessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.projectId, projectId))
    const sessionIds = sessions.map((s: { id: string }) => s.id)

    // 2. Delete messages and token_usage for those sessions (batch)
    if (sessionIds.length > 0) {
      await db.delete(schema.messages).where(inArray(schema.messages.sessionId, sessionIds))
      await db.delete(schema.tokenUsage).where(inArray(schema.tokenUsage.sessionId, sessionIds))
    }

    // 3. Delete sessions, tasks, notes, permission_rules, mcp_servers
    await db.delete(schema.sessions).where(eq(schema.sessions.projectId, projectId))
    await db.delete(schema.tasks).where(eq(schema.tasks.projectId, projectId))
    await db.delete(schema.notes).where(eq(schema.notes.projectId, projectId))
    await db.delete(schema.permissionRules).where(eq(schema.permissionRules.projectId, projectId))
    await db.delete(schema.mcpServers).where(eq(schema.mcpServers.projectId, projectId))

    // 4. Delete the project
    await db
      .delete(schema.projects)
      .where(and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, userId)
      ))
    return true
  }
  async moveToOrg(projectId: string, userId: string, orgId: string | null) {
    // Verify ownership
    const project = await this.getById(projectId, userId)
    if (!project) return null

    const [updated] = await db
      .update(schema.projects)
      .set({ orgId, updatedAt: new Date() })
      .where(and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, userId)
      ))
      .returning()
    return updated || null
  }
}

export const projectService = new ProjectService()
