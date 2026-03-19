import { create } from 'zustand'
import type { Skill, CreateSkillInput } from '@axy/shared'
import { api } from '@/lib/api-client'

export interface CatalogSkill {
  id: string
  name: string
  description: string
  category: string
  trigger: string
  promptTemplate: string
  source: 'official' | 'community'
  author?: string
}

interface SkillState {
  skills: Skill[]
  isLoading: boolean

  catalogSkills: CatalogSkill[]
  isCatalogLoading: boolean

  fetchSkills: () => Promise<void>
  createSkill: (input: CreateSkillInput) => Promise<Skill>
  updateSkill: (id: string, data: Partial<CreateSkillInput>) => Promise<void>
  deleteSkill: (id: string) => Promise<void>

  fetchCatalog: () => Promise<void>
  importSkill: (catalogId: string, orgId?: string) => Promise<Skill>
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  isLoading: false,

  catalogSkills: [],
  isCatalogLoading: false,

  fetchSkills: async () => {
    set({ isLoading: true })
    try {
      const skills = await api.get<Skill[]>('/api/skills')
      set({ skills })
    } finally {
      set({ isLoading: false })
    }
  },

  createSkill: async (input) => {
    const skill = await api.post<Skill>('/api/skills', input)
    set((s) => ({ skills: [skill, ...s.skills] }))
    return skill
  },

  updateSkill: async (id, data) => {
    const skill = await api.put<Skill>(`/api/skills/${id}`, data)
    set((s) => ({ skills: s.skills.map(sk => sk.id === id ? skill : sk) }))
  },

  deleteSkill: async (id) => {
    await api.delete(`/api/skills/${id}`)
    set((s) => ({ skills: s.skills.filter(sk => sk.id !== id) }))
  },

  fetchCatalog: async () => {
    set({ isCatalogLoading: true })
    try {
      const catalogSkills = await api.get<CatalogSkill[]>('/api/skills/catalog')
      set({ catalogSkills })
    } finally {
      set({ isCatalogLoading: false })
    }
  },

  importSkill: async (catalogId, orgId) => {
    const skill = await api.post<Skill>(`/api/skills/import/${catalogId}`, orgId ? { orgId } : {})
    set((s) => ({ skills: [skill, ...s.skills] }))
    return skill
  },
}))
