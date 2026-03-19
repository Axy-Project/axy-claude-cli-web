import { eq, and, or, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { CreateSkillInput } from '@axy/shared'

export class SkillService {
  async list(userId: string, orgId?: string) {
    return db
      .select()
      .from(schema.skills)
      .where(
        or(
          eq(schema.skills.userId, userId),
          eq(schema.skills.isGlobal, true),
          orgId ? eq(schema.skills.orgId, orgId) : undefined
        )
      )
      .orderBy(desc(schema.skills.updatedAt))
  }

  async getById(skillId: string) {
    const [skill] = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.id, skillId))
      .limit(1)
    return skill || null
  }

  async create(userId: string, input: CreateSkillInput) {
    const [skill] = await db
      .insert(schema.skills)
      .values({
        userId,
        orgId: input.orgId,
        name: input.name,
        description: input.description,
        trigger: input.trigger,
        promptTemplate: input.promptTemplate,
        category: input.category || 'general',
        allowedToolsJson: input.allowedToolsJson,
        isGlobal: input.isGlobal || false,
      })
      .returning()
    return skill
  }

  async update(skillId: string, userId: string, data: Partial<CreateSkillInput>) {
    const [skill] = await db
      .update(schema.skills)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(schema.skills.id, skillId),
        eq(schema.skills.userId, userId)
      ))
      .returning()
    return skill || null
  }

  async delete(skillId: string, userId: string) {
    await db
      .delete(schema.skills)
      .where(and(
        eq(schema.skills.id, skillId),
        eq(schema.skills.userId, userId)
      ))
  }

  /** Resolve a skill's prompt template with variables */
  resolveTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`)
  }
}

export const skillService = new SkillService()
