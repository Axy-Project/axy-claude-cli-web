import { eq, and, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { OrgRole } from '@axy/shared'

export class OrgService {
  async list(userId: string) {
    const memberships = await db
      .select()
      .from(schema.orgMembers)
      .where(eq(schema.orgMembers.userId, userId))

    if (memberships.length === 0) return []

    const orgIds = memberships.map((m: any) => m.orgId)
    const orgs = await db
      .select()
      .from(schema.organizations)
      .where(inArray(schema.organizations.id, orgIds))
    return orgs
  }

  async getById(orgId: string) {
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId))
      .limit(1)
    return org || null
  }

  async create(userId: string, name: string, slug: string) {
    const [org] = await db
      .insert(schema.organizations)
      .values({ name, slug })
      .returning()

    // Add creator as owner
    await db
      .insert(schema.orgMembers)
      .values({
        orgId: org.id,
        userId,
        role: 'owner',
      })

    return org
  }

  async update(orgId: string, data: { name?: string; avatarUrl?: string }) {
    const [org] = await db
      .update(schema.organizations)
      .set(data)
      .where(eq(schema.organizations.id, orgId))
      .returning()
    return org || null
  }

  async listMembers(orgId: string) {
    return db
      .select({
        id: schema.orgMembers.id,
        orgId: schema.orgMembers.orgId,
        userId: schema.orgMembers.userId,
        role: schema.orgMembers.role,
        joinedAt: schema.orgMembers.joinedAt,
        user: {
          id: schema.users.id,
          email: schema.users.email,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
        },
      })
      .from(schema.orgMembers)
      .innerJoin(schema.users, eq(schema.orgMembers.userId, schema.users.id))
      .where(eq(schema.orgMembers.orgId, orgId))
  }

  async addMember(orgId: string, userId: string, role: OrgRole = 'member') {
    const [member] = await db
      .insert(schema.orgMembers)
      .values({ orgId, userId, role })
      .returning()
    return member
  }

  async removeMember(orgId: string, userId: string) {
    await db
      .delete(schema.orgMembers)
      .where(and(
        eq(schema.orgMembers.orgId, orgId),
        eq(schema.orgMembers.userId, userId)
      ))
  }

  async checkMembership(orgId: string, userId: string): Promise<OrgRole | null> {
    const [member] = await db
      .select()
      .from(schema.orgMembers)
      .where(and(
        eq(schema.orgMembers.orgId, orgId),
        eq(schema.orgMembers.userId, userId)
      ))
      .limit(1)
    return (member?.role as OrgRole) || null
  }
}

export const orgService = new OrgService()
