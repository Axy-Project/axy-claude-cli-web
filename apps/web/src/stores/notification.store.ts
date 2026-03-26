import { create } from 'zustand'
import { api } from '@/lib/api-client'
import { wsClient } from '@/lib/ws-client'

export interface AppNotification {
  id: string
  userId: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  read: boolean
  metadataJson?: unknown
  createdAt: string
}

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  isLoading: boolean

  fetch: () => Promise<void>
  fetchCount: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  addNotification: (n: AppNotification) => void
  initWsListener: () => () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true })
    try {
      const res = await api.get<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications')
      set({ notifications: res.notifications, unreadCount: res.unreadCount })
    } catch {
      // ignore
    } finally {
      set({ isLoading: false })
    }
  },

  fetchCount: async () => {
    try {
      const res = await api.get<{ count: number }>('/api/notifications/count')
      set({ unreadCount: res.count })
    } catch {
      // ignore
    }
  },

  markRead: async (id: string) => {
    try {
      await api.post(`/api/notifications/${id}/read`)
      set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
    } catch {
      // ignore
    }
  },

  markAllRead: async () => {
    try {
      await api.post('/api/notifications/read-all')
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }))
    } catch {
      // ignore
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await api.delete(`/api/notifications/${id}`)
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: s.notifications.find((n) => n.id === id && !n.read) ? s.unreadCount - 1 : s.unreadCount,
      }))
    } catch {
      // ignore
    }
  },

  addNotification: (n: AppNotification) => {
    set((s) => ({
      notifications: [n, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }))
  },

  initWsListener: () => {
    const unsub = wsClient.on('notification:new', (data) => {
      get().addNotification(data as AppNotification)
      // Browser notification when tab is not focused
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        const n = data as AppNotification
        const notif = new Notification(n.title, {
          body: n.body || undefined,
          icon: '/logo.png',
          tag: n.id,
        })
        notif.onclick = () => {
          window.focus()
          if (n.link) window.location.href = n.link
          notif.close()
        }
        setTimeout(() => notif.close(), 8000)
      }
    })
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    return unsub
  },
}))
