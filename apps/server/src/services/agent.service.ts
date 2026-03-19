import { eq, and, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { CreateAgentInput } from '@axy/shared'

export class AgentService {
  async list(userId: string, orgId?: string) {
    return db
      .select()
      .from(schema.agentProfiles)
      .where(
        orgId
          ? and(eq(schema.agentProfiles.orgId, orgId))
          : eq(schema.agentProfiles.userId, userId)
      )
      .orderBy(desc(schema.agentProfiles.updatedAt))
  }

  async getById(agentId: string) {
    const [agent] = await db
      .select()
      .from(schema.agentProfiles)
      .where(eq(schema.agentProfiles.id, agentId))
      .limit(1)
    return agent || null
  }

  async create(userId: string, input: CreateAgentInput) {
    const [agent] = await db
      .insert(schema.agentProfiles)
      .values({
        userId,
        orgId: input.orgId,
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color,
        role: input.role || 'general',
        model: input.model || 'claude-sonnet-4-20250514',
        systemPrompt: input.systemPrompt,
        allowedToolsJson: input.allowedToolsJson,
        disallowedToolsJson: input.disallowedToolsJson,
        maxTokens: input.maxTokens || 16384,
        temperature: input.temperature || 1.0,
        extendedThinking: input.extendedThinking || false,
        thinkingBudget: input.thinkingBudget || 10000,
        permissionMode: input.permissionMode || 'default',
        bossAgentId: input.bossAgentId,
        budgetMonthlyUsd: input.budgetMonthlyUsd,
        budgetDailyUsd: input.budgetDailyUsd,
      })
      .returning()
    return agent
  }

  async update(agentId: string, userId: string, data: Partial<CreateAgentInput>) {
    const [agent] = await db
      .update(schema.agentProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(schema.agentProfiles.id, agentId),
        eq(schema.agentProfiles.userId, userId)
      ))
      .returning()
    return agent || null
  }

  async delete(agentId: string, userId: string) {
    await db
      .delete(schema.agentProfiles)
      .where(and(
        eq(schema.agentProfiles.id, agentId),
        eq(schema.agentProfiles.userId, userId)
      ))
  }

  async getHierarchy(userId: string) {
    const agents: any[] = await this.list(userId)
    // Build hierarchy tree
    const roots = agents.filter((a: any) => !a.bossAgentId)
    const buildTree = (parentId: string): any[] => {
      return agents
        .filter((a: any) => a.bossAgentId === parentId)
        .map((a: any) => ({ ...a, children: buildTree(a.id) }))
    }
    return roots.map((r: any) => ({ ...r, children: buildTree(r.id) }))
  }
}

export const agentService = new AgentService()
