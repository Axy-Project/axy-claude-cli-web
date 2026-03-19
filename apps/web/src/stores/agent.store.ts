import { create } from 'zustand'
import type { AgentProfile, CreateAgentInput } from '@axy/shared'
import { api } from '@/lib/api-client'

export interface CatalogAgent {
  id: string
  name: string
  description: string
  category: string
  role: string
  icon: string
  color: string
  model: string
  systemPrompt: string
  allowedTools?: string[]
  disallowedTools?: string[]
  extendedThinking?: boolean
  thinkingBudget?: number
  source: 'official' | 'community'
}

interface CatalogResponse {
  agents: CatalogAgent[]
  categories: string[]
}

interface AgentState {
  agents: AgentProfile[]
  selectedAgent: AgentProfile | null
  isLoading: boolean
  isSaving: boolean

  catalogAgents: CatalogAgent[]
  catalogCategories: string[]
  isCatalogLoading: boolean
  isImporting: string | null

  fetchAgents: () => Promise<void>
  fetchAgent: (id: string) => Promise<void>
  createAgent: (input: CreateAgentInput) => Promise<AgentProfile>
  updateAgent: (id: string, data: Partial<CreateAgentInput>) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  setSelectedAgent: (agent: AgentProfile | null) => void

  fetchCatalog: () => Promise<void>
  importAgent: (catalogId: string, orgId?: string) => Promise<AgentProfile>
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  selectedAgent: null,
  isLoading: false,
  isSaving: false,

  catalogAgents: [],
  catalogCategories: [],
  isCatalogLoading: false,
  isImporting: null,

  fetchAgents: async () => {
    set({ isLoading: true })
    try {
      const agents = await api.get<AgentProfile[]>('/api/agents')
      set({ agents })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchAgent: async (id) => {
    const agent = await api.get<AgentProfile>(`/api/agents/${id}`)
    set({ selectedAgent: agent })
  },

  createAgent: async (input) => {
    set({ isSaving: true })
    try {
      const agent = await api.post<AgentProfile>('/api/agents', input)
      set((s) => ({ agents: [agent, ...s.agents] }))
      return agent
    } finally {
      set({ isSaving: false })
    }
  },

  updateAgent: async (id, data) => {
    set({ isSaving: true })
    try {
      const agent = await api.put<AgentProfile>(`/api/agents/${id}`, data)
      set((s) => ({
        agents: s.agents.map(a => a.id === id ? agent : a),
        selectedAgent: s.selectedAgent?.id === id ? agent : s.selectedAgent,
      }))
    } finally {
      set({ isSaving: false })
    }
  },

  deleteAgent: async (id) => {
    await api.delete(`/api/agents/${id}`)
    set((s) => ({
      agents: s.agents.filter(a => a.id !== id),
      selectedAgent: s.selectedAgent?.id === id ? null : s.selectedAgent,
    }))
  },

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),

  fetchCatalog: async () => {
    set({ isCatalogLoading: true })
    try {
      const data = await api.get<CatalogResponse>('/api/agents/catalog')
      set({ catalogAgents: data.agents, catalogCategories: data.categories })
    } finally {
      set({ isCatalogLoading: false })
    }
  },

  importAgent: async (catalogId, orgId?) => {
    set({ isImporting: catalogId })
    try {
      const agent = await api.post<AgentProfile>(`/api/agents/import/${catalogId}`, orgId ? { orgId } : undefined)
      set((s) => ({ agents: [agent, ...s.agents] }))
      return agent
    } finally {
      set({ isImporting: null })
    }
  },
}))
