import { create } from 'zustand'
import type { Organization, OrgMember } from '@axy/shared'
import type { OrgRole } from '@axy/shared'
import { api } from '@/lib/api-client'

interface OrgState {
  orgs: Organization[]
  currentOrg: Organization | null
  members: OrgMember[]
  isLoading: boolean

  fetchOrgs: () => Promise<void>
  fetchOrg: (id: string) => Promise<void>
  createOrg: (data: { name: string; slug: string }) => Promise<Organization>
  updateOrg: (id: string, data: { name?: string; slug?: string }) => Promise<void>
  deleteOrg: (id: string) => Promise<void>
  fetchMembers: (orgId: string) => Promise<void>
  addMember: (orgId: string, data: { userId: string; role: OrgRole }) => Promise<void>
  removeMember: (orgId: string, userId: string) => Promise<void>
}

export const useOrgStore = create<OrgState>((set) => ({
  orgs: [],
  currentOrg: null,
  members: [],
  isLoading: false,

  fetchOrgs: async () => {
    set({ isLoading: true })
    try {
      const orgs = await api.get<Organization[]>('/api/orgs')
      set({ orgs })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchOrg: async (id) => {
    set({ isLoading: true })
    try {
      const org = await api.get<Organization>(`/api/orgs/${id}`)
      set({ currentOrg: org })
    } finally {
      set({ isLoading: false })
    }
  },

  createOrg: async (data) => {
    const org = await api.post<Organization>('/api/orgs', data)
    set((state) => ({ orgs: [org, ...state.orgs] }))
    return org
  },

  updateOrg: async (id, data) => {
    const org = await api.put<Organization>(`/api/orgs/${id}`, data)
    set((state) => ({
      orgs: state.orgs.map((o) => (o.id === id ? org : o)),
      currentOrg: state.currentOrg?.id === id ? org : state.currentOrg,
    }))
  },

  deleteOrg: async (id) => {
    await api.delete(`/api/orgs/${id}`)
    set((state) => ({
      orgs: state.orgs.filter((o) => o.id !== id),
      currentOrg: state.currentOrg?.id === id ? null : state.currentOrg,
    }))
  },

  fetchMembers: async (orgId) => {
    const members = await api.get<OrgMember[]>(`/api/orgs/${orgId}/members`)
    set({ members })
  },

  addMember: async (orgId, data) => {
    const member = await api.post<OrgMember>(`/api/orgs/${orgId}/members`, data)
    set((state) => ({ members: [...state.members, member] }))
  },

  removeMember: async (orgId, userId) => {
    await api.delete(`/api/orgs/${orgId}/members/${userId}`)
    set((state) => ({
      members: state.members.filter((m) => m.userId !== userId),
    }))
  },
}))
