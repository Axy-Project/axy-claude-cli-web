import { create } from 'zustand'
import type { McpServer } from '@axy/shared'
import { api } from '@/lib/api-client'

// ─── Registry types ──────────────────────────────────────

export interface RegistryServerRemote {
  type: string
  url: string
}

export interface RegistryServerPackage {
  registryType: string
  identifier: string
  environmentVariables?: { name: string; description: string; required: boolean }[]
}

export interface RegistryServer {
  server: {
    name: string
    description: string
    version: string
    title: string
    remotes?: RegistryServerRemote[]
    packages?: RegistryServerPackage[]
  }
  _meta?: {
    'com.anthropic.api/mcp-registry'?: {
      toolNames?: string[]
      worksWith?: string[]
      displayName?: string
      oneLiner?: string
      claudeCodeCopyText?: string
    }
  }
}

interface RegistryBrowseResponse {
  servers: RegistryServer[]
  metadata: { nextCursor?: string }
}

// ─── Store types ─────────────────────────────────────────

interface CreateMcpServerInput {
  projectId: string
  name: string
  type: string
  command: string
  argsJson: string[]
  envJson: Record<string, string>
  isEnabled?: boolean
}

interface McpState {
  servers: McpServer[]
  isLoading: boolean

  // Registry
  registryServers: RegistryServer[]
  registryLoading: boolean
  registryNextCursor: string | null
  registrySearch: string

  fetchServers: (projectId: string) => Promise<void>
  createServer: (input: CreateMcpServerInput) => Promise<McpServer>
  updateServer: (id: string, data: Partial<CreateMcpServerInput>) => Promise<void>
  deleteServer: (id: string) => Promise<void>
  toggleServer: (id: string, isEnabled: boolean) => Promise<void>

  browseRegistry: (search?: string) => Promise<void>
  loadMoreRegistry: () => Promise<void>
  importFromRegistry: (projectId: string, server: RegistryServer) => Promise<McpServer>
}

export const useMcpStore = create<McpState>((set, get) => ({
  servers: [],
  isLoading: false,

  // Registry
  registryServers: [],
  registryLoading: false,
  registryNextCursor: null,
  registrySearch: '',

  fetchServers: async (projectId) => {
    set({ isLoading: true })
    try {
      const servers = await api.get<McpServer[]>(`/api/mcp/project/${projectId}`)
      set({ servers })
    } finally {
      set({ isLoading: false })
    }
  },

  createServer: async (input) => {
    const server = await api.post<McpServer>('/api/mcp', input)
    set((s) => ({ servers: [server, ...s.servers] }))
    return server
  },

  updateServer: async (id, data) => {
    const server = await api.put<McpServer>(`/api/mcp/${id}`, data)
    set((s) => ({ servers: s.servers.map(sv => sv.id === id ? server : sv) }))
  },

  deleteServer: async (id) => {
    await api.delete(`/api/mcp/${id}`)
    set((s) => ({ servers: s.servers.filter(sv => sv.id !== id) }))
  },

  toggleServer: async (id, isEnabled) => {
    const server = await api.put<McpServer>(`/api/mcp/${id}`, { isEnabled })
    set((s) => ({ servers: s.servers.map(sv => sv.id === id ? server : sv) }))
  },

  browseRegistry: async (search?: string) => {
    set({ registryLoading: true, registrySearch: search || '' })
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const data = await api.get<RegistryBrowseResponse>(
        `/api/mcp/registry/browse${params.toString() ? `?${params}` : ''}`
      )
      set({
        registryServers: data.servers || [],
        registryNextCursor: data.metadata?.nextCursor || null,
      })
    } catch (err) {
      console.error('Failed to browse registry:', err)
      set({ registryServers: [], registryNextCursor: null })
    } finally {
      set({ registryLoading: false })
    }
  },

  loadMoreRegistry: async () => {
    const { registryNextCursor, registrySearch, registryServers } = get()
    if (!registryNextCursor) return
    set({ registryLoading: true })
    try {
      const params = new URLSearchParams({ cursor: registryNextCursor })
      if (registrySearch) params.set('search', registrySearch)
      const data = await api.get<RegistryBrowseResponse>(
        `/api/mcp/registry/browse?${params}`
      )
      set({
        registryServers: [...registryServers, ...(data.servers || [])],
        registryNextCursor: data.metadata?.nextCursor || null,
      })
    } catch (err) {
      console.error('Failed to load more registry servers:', err)
    } finally {
      set({ registryLoading: false })
    }
  },

  importFromRegistry: async (projectId, registryEntry) => {
    const meta = registryEntry._meta?.['com.anthropic.api/mcp-registry']
    const srv = registryEntry.server
    const displayName = meta?.displayName || srv.title || srv.name

    // Build import payload
    const body: Record<string, unknown> = {
      projectId,
      serverName: srv.name,
      displayName,
    }

    // Prefer remote HTTP transport if available
    if (srv.remotes && srv.remotes.length > 0) {
      const remote = srv.remotes[0]
      body.remoteUrl = remote.url
      body.transportType = remote.type
    } else if (srv.packages && srv.packages.length > 0) {
      // npm package: use npx
      const pkg = srv.packages[0]
      body.command = 'npx'
      body.argsJson = ['-y', pkg.identifier]
    }

    const server = await api.post<McpServer>('/api/mcp/registry/import', body)
    set((s) => ({ servers: [server, ...s.servers] }))
    return server
  },
}))
