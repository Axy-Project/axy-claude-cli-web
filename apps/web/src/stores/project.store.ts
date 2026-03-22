import { create } from 'zustand'
import type { Project, CreateProjectInput, ImportProjectInput } from '@axy/shared'
import { api } from '@/lib/api-client'

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  isLoading: boolean

  fetchProjects: () => Promise<void>
  fetchProject: (id: string) => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<Project>
  importProject: (input: ImportProjectInput) => Promise<Project>
  uploadProject: (data: { name: string; description?: string; permissionMode?: string; orgId?: string; files: File[]; onProgress?: (msg: string) => void }) => Promise<Project>
  updateProject: (id: string, data: Partial<CreateProjectInput>) => Promise<void>
  deleteProject: (id: string, password?: string) => Promise<void>
  moveProject: (id: string, orgId: string | null) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true })
    try {
      const projects = await api.get<Project[]>('/api/projects')
      set({ projects })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchProject: async (id) => {
    const project = await api.get<Project>(`/api/projects/${id}`)
    set({ currentProject: project })
  },

  createProject: async (input) => {
    const project = await api.post<Project>('/api/projects', input)
    set((state) => ({ projects: [project, ...state.projects] }))
    return project
  },

  importProject: async (input) => {
    const project = await api.post<Project>('/api/projects/import', input)
    set((state) => ({ projects: [project, ...state.projects] }))
    return project
  },

  uploadProject: async ({ name, description, permissionMode, orgId, files, onProgress }) => {
    // Step 1: Create the project first (empty)
    const project = await api.post<Project>('/api/projects', {
      name,
      description,
      permissionMode,
      orgId,
    })

    // Step 2: Upload files in batches via the file upload endpoint
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // Skip files > 10MB
    const BATCH_SIZE = 10
    const uploadableFiles: { file: File; relativePath: string }[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) continue // skip large binaries
      let relativePath = (file as any).webkitRelativePath || file.name
      // Strip the leading root folder (e.g. "my-folder/src/index.ts" -> "src/index.ts")
      const parts = relativePath.split('/')
      if (parts.length > 1) {
        relativePath = parts.slice(1).join('/')
      }
      if (!relativePath) continue
      uploadableFiles.push({ file, relativePath })
    }

    const total = uploadableFiles.length
    let uploaded = 0
    onProgress?.(`Uploading 0/${total} files...`)

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = uploadableFiles.slice(i, i + BATCH_SIZE)
      const filePayloads: { path: string; data: string }[] = []

      for (const { file, relativePath } of batch) {
        try {
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result as string
              resolve(result.split(',')[1] || '')
            }
            reader.onerror = () => reject(new Error(`Failed to read ${relativePath}`))
            reader.readAsDataURL(file)
          })
          filePayloads.push({ path: relativePath, data })
        } catch (err) {
          console.warn(`[upload] Skip file read error: ${relativePath}`, err)
        }
      }

      if (filePayloads.length > 0) {
        try {
          await api.post(`/api/files/projects/${project.id}/upload`, { files: filePayloads })
        } catch (err) {
          console.warn(`[upload] Batch ${i / BATCH_SIZE + 1} failed:`, err)
        }
      }
      uploaded += batch.length
      onProgress?.(`Uploading ${uploaded}/${total} files...`)
    }

    set((state) => ({ projects: [project, ...state.projects] }))
    return project
  },

  updateProject: async (id, data) => {
    const project = await api.put<Project>(`/api/projects/${id}`, data)
    set((state) => ({
      projects: state.projects.map(p => p.id === id ? project : p),
      currentProject: state.currentProject?.id === id ? project : state.currentProject,
    }))
  },

  deleteProject: async (id, password?: string) => {
    await api.delete(`/api/projects/${id}`, password ? { password } : undefined)
    set((state) => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }))
  },

  moveProject: async (id, orgId) => {
    const project = await api.post<Project>(`/api/projects/${id}/move`, { orgId })
    set((state) => ({
      projects: state.projects.map(p => p.id === id ? project : p),
      currentProject: state.currentProject?.id === id ? project : state.currentProject,
    }))
  },
}))
