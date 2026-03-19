import { create } from 'zustand'
import type { GitStatus, GitLogEntry } from '@axy/shared'
import { api } from '@/lib/api-client'

interface PrInfo {
  number: number
  title: string
  url: string
  state?: string
  merged?: boolean
}

interface GitState {
  status: GitStatus | null
  branches: string[]
  log: GitLogEntry[]
  diff: string
  isLoading: boolean
  isCommitting: boolean
  isPushing: boolean
  isPulling: boolean
  isCheckingOut: boolean
  isCreatingPr: boolean
  isMergingPr: boolean
  lastPr: PrInfo | null
  checkoutMessage: string | null
  error: string | null

  fetchStatus: (projectId: string) => Promise<void>
  fetchBranches: (projectId: string) => Promise<void>
  fetchLog: (projectId: string, maxCount?: number) => Promise<void>
  fetchDiff: (projectId: string, staged?: boolean) => Promise<void>
  commit: (projectId: string, message: string, files?: string[]) => Promise<void>
  push: (projectId: string) => Promise<void>
  pull: (projectId: string) => Promise<void>
  checkout: (projectId: string, branch: string) => Promise<void>
  createPr: (projectId: string, params: { title: string; body?: string; baseBranch?: string }) => Promise<PrInfo>
  mergePr: (projectId: string, prNumber: number, mergeMethod?: string) => Promise<void>
  linkRepo: (projectId: string, repoUrl: string) => Promise<void>
  discard: (projectId: string, file?: string) => Promise<void>
  stage: (projectId: string, files: string[]) => Promise<void>
  unstage: (projectId: string, files: string[]) => Promise<void>
  stageAll: (projectId: string) => Promise<void>
  createBranch: (projectId: string, branchName: string) => Promise<void>
  generateMessage: (projectId: string) => Promise<string>
  fetchAll: (projectId: string) => Promise<void>
  clearError: () => void
}

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  branches: [],
  log: [],
  diff: '',
  isLoading: false,
  isCommitting: false,
  isPushing: false,
  isPulling: false,
  isCheckingOut: false,
  isCreatingPr: false,
  isMergingPr: false,
  lastPr: null,
  checkoutMessage: null,
  error: null,

  fetchStatus: async (projectId) => {
    try {
      const status = await api.get<GitStatus>(`/api/git/projects/${projectId}/status`)
      set({ status })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  fetchBranches: async (projectId) => {
    try {
      const data = await api.get<{ current: string; all: string[] }>(`/api/git/projects/${projectId}/branches`)
      set({ branches: data.all || [] })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  fetchLog: async (projectId, maxCount = 30) => {
    try {
      const log = await api.get<GitLogEntry[]>(`/api/git/projects/${projectId}/log?maxCount=${maxCount}`)
      set({ log })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  fetchDiff: async (projectId, staged = false) => {
    try {
      const diff = await api.get<string>(`/api/git/projects/${projectId}/diff?staged=${staged}`)
      set({ diff })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  commit: async (projectId, message, files) => {
    set({ isCommitting: true, error: null })
    try {
      await api.post(`/api/git/projects/${projectId}/commit`, { message, files })
      await Promise.all([
        get().fetchStatus(projectId),
        get().fetchLog(projectId),
        get().fetchDiff(projectId),
      ])
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    } finally {
      set({ isCommitting: false })
    }
  },

  push: async (projectId) => {
    set({ isPushing: true, error: null })
    try {
      await api.post(`/api/git/projects/${projectId}/push`, {})
      await get().fetchStatus(projectId)
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    } finally {
      set({ isPushing: false })
    }
  },

  pull: async (projectId) => {
    set({ isPulling: true, error: null })
    try {
      await api.post(`/api/git/projects/${projectId}/pull`, {})
      await Promise.all([
        get().fetchStatus(projectId),
        get().fetchLog(projectId),
        get().fetchDiff(projectId),
      ])
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    } finally {
      set({ isPulling: false })
    }
  },

  checkout: async (projectId, branch) => {
    set({ isCheckingOut: true, error: null, checkoutMessage: null })
    try {
      const res = await api.post<{ message: string; data: { stashApplied: boolean; conflicts: boolean } }>(
        `/api/git/projects/${projectId}/checkout`, { branch }
      )
      // Show checkout result message
      if (res.data?.conflicts) {
        set({ checkoutMessage: `Switched to ${branch} — conflicts during stash pop. Check your files.` })
      } else if (res.data?.stashApplied) {
        set({ checkoutMessage: `Switched to ${branch} with changes preserved.` })
      }
      // Fetch remote refs then refresh everything
      api.post(`/api/git/projects/${projectId}/fetch`, {}).catch(() => {})
      await Promise.all([
        get().fetchStatus(projectId),
        get().fetchBranches(projectId),
        get().fetchLog(projectId),
        get().fetchDiff(projectId),
      ])
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    } finally {
      set({ isCheckingOut: false })
    }
  },

  createPr: async (projectId, params) => {
    set({ isCreatingPr: true, error: null })
    try {
      const pr = await api.post<PrInfo>('/api/github/repos/create-pr', {
        projectId,
        title: params.title,
        body: params.body,
        baseBranch: params.baseBranch,
      })
      set({ lastPr: pr })
      return pr
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    } finally {
      set({ isCreatingPr: false })
    }
  },

  mergePr: async (projectId, prNumber, mergeMethod) => {
    set({ isMergingPr: true, error: null })
    try {
      await api.post(`/api/github/repos/${projectId}/prs/${prNumber}/merge`, { mergeMethod })
      set({ lastPr: null })
      // Refresh after merge+pull
      await Promise.all([
        get().fetchStatus(projectId),
        get().fetchLog(projectId),
        get().fetchDiff(projectId),
      ])
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    } finally {
      set({ isMergingPr: false })
    }
  },

  linkRepo: async (projectId, repoUrl) => {
    set({ isLoading: true, error: null })
    try {
      await api.post(`/api/git/projects/${projectId}/link-repo`, { repoUrl })
      await get().fetchAll(projectId)
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  discard: async (projectId, file) => {
    try {
      await api.post(`/api/git/projects/${projectId}/discard`, file ? { file } : {})
      await Promise.all([
        get().fetchStatus(projectId),
        get().fetchDiff(projectId),
      ])
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  stage: async (projectId, files) => {
    try {
      await api.post(`/api/git/projects/${projectId}/stage`, { files })
      await get().fetchStatus(projectId)
      await get().fetchDiff(projectId)
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  unstage: async (projectId, files) => {
    try {
      await api.post(`/api/git/projects/${projectId}/unstage`, { files })
      await get().fetchStatus(projectId)
      await get().fetchDiff(projectId)
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  stageAll: async (projectId) => {
    try {
      await api.post(`/api/git/projects/${projectId}/stage`, { files: ['.'] })
      await get().fetchStatus(projectId)
      await get().fetchDiff(projectId)
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  createBranch: async (projectId, branchName) => {
    set({ isCheckingOut: true, error: null })
    try {
      await api.post(`/api/git/projects/${projectId}/create-branch`, { branch: branchName })
      await Promise.all([
        get().fetchStatus(projectId),
        get().fetchBranches(projectId),
      ])
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    } finally {
      set({ isCheckingOut: false })
    }
  },

  generateMessage: async (projectId) => {
    try {
      const result = await api.post<{ message: string }>(`/api/git/projects/${projectId}/generate-message`, {})
      return result.message
    } catch (error) {
      set({ error: (error as Error).message })
      return ''
    }
  },

  fetchAll: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      // Fetch remote refs first so ahead/behind is accurate
      await api.post(`/api/git/projects/${projectId}/fetch`, {}).catch(() => {})
      await Promise.all([
        get().fetchStatus(projectId),
        get().fetchBranches(projectId),
        get().fetchLog(projectId),
        get().fetchDiff(projectId),
      ])
    } finally {
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null, checkoutMessage: null }),
}))
