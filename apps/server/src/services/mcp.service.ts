import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export class McpService {
  async listByProject(projectId: string) {
    return db
      .select()
      .from(schema.mcpServers)
      .where(eq(schema.mcpServers.projectId, projectId))
  }

  async getById(id: string) {
    const [server] = await db
      .select()
      .from(schema.mcpServers)
      .where(eq(schema.mcpServers.id, id))
      .limit(1)
    return server || null
  }

  async create(input: {
    projectId: string
    name: string
    type?: string
    command: string
    argsJson?: string[]
    envJson?: Record<string, string>
  }) {
    const [server] = await db
      .insert(schema.mcpServers)
      .values({
        projectId: input.projectId,
        name: input.name,
        type: input.type || 'stdio',
        command: input.command,
        argsJson: input.argsJson || [],
        envJson: input.envJson || {},
      })
      .returning()
    return server
  }

  async update(id: string, data: Partial<{
    name: string
    type: string
    command: string
    argsJson: string[]
    envJson: Record<string, string>
    isEnabled: boolean
  }>) {
    const [server] = await db
      .update(schema.mcpServers)
      .set(data)
      .where(eq(schema.mcpServers.id, id))
      .returning()
    return server || null
  }

  async delete(id: string) {
    await db
      .delete(schema.mcpServers)
      .where(eq(schema.mcpServers.id, id))
  }

  async getConfigForProject(projectId: string) {
    const servers = await db
      .select()
      .from(schema.mcpServers)
      .where(
        and(
          eq(schema.mcpServers.projectId, projectId),
          eq(schema.mcpServers.isEnabled, true)
        )
      )

    const mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }> = {}

    for (const server of servers) {
      mcpServers[server.name] = {
        command: server.command,
        args: (server.argsJson as string[]) || [],
        env: (server.envJson as Record<string, string>) || {},
      }
    }

    return { mcpServers }
  }
}

export const mcpService = new McpService()
