import { create } from 'zustand'
import { api } from '@/lib/api-client'
import { wsClient } from '@/lib/ws-client'
import { notifications } from '@/lib/notifications'

export type TaskType = 'background_task' | 'slash_command' | 'subagent'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Task {
  id: string
  sessionId?: string
  userId: string
  projectId: string
  type: TaskType
  status: TaskStatus
  title: string
  description?: string
  command?: string
  result?: string
  error?: string
  progress: number
  metadataJson: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  durationMs?: number
  createdAt: string
  updatedAt: string
}

interface TaskState {
  tasks: Task[]
  isLoading: boolean
  isPanelOpen: boolean

  fetchTasks: (projectId: string) => Promise<void>
  fetchSessionTasks: (sessionId: string) => Promise<void>
  createTask: (input: {
    sessionId?: string
    projectId: string
    type?: TaskType
    title: string
    description?: string
    command?: string
    metadataJson?: Record<string, unknown>
  }) => Promise<Task>
  cancelTask: (taskId: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  togglePanel: () => void
  initWsListeners: () => () => void
  reset: () => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  isPanelOpen: false,

  fetchTasks: async (projectId) => {
    set({ isLoading: true })
    try {
      const tasks = await api.get<Task[]>(`/api/tasks?projectId=${projectId}`)
      set({ tasks })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchSessionTasks: async (sessionId) => {
    set({ isLoading: true })
    try {
      const tasks = await api.get<Task[]>(`/api/tasks?sessionId=${sessionId}`)
      set({ tasks })
    } finally {
      set({ isLoading: false })
    }
  },

  createTask: async (input) => {
    const task = await api.post<Task>('/api/tasks', input)
    set((state) => {
      const exists = state.tasks.some((t) => t.id === task.id)
      if (exists) return state
      return { tasks: [task, ...state.tasks] }
    })
    return task
  },

  cancelTask: async (taskId) => {
    await api.post(`/api/tasks/${taskId}/cancel`)
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'cancelled' as TaskStatus } : t
      ),
    }))
  },

  deleteTask: async (taskId) => {
    await api.delete(`/api/tasks/${taskId}`)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }))
  },

  togglePanel: () => {
    set((state) => ({ isPanelOpen: !state.isPanelOpen }))
  },

  initWsListeners: () => {
    const unsubs = [
      wsClient.on('task:created' as any, (data: any) => {
        set((state) => {
          const exists = state.tasks.some((t) => t.id === data.task.id)
          if (exists) return state
          return { tasks: [data.task, ...state.tasks] }
        })
      }),

      wsClient.on('task:updated' as any, (data: any) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === data.task.id ? data.task : t
          ),
        }))
      }),

      wsClient.on('task:completed' as any, (data: any) => {
        const task = data.task
        if (task.status === 'completed' || task.status === 'failed') {
          notifications.notifyTaskComplete(task.title, task.status)
        }
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === task.id ? task : t
          ),
        }))
      }),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  },

  reset: () => {
    set({ tasks: [], isLoading: false, isPanelOpen: false })
  },
}))
