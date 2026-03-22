import { create } from 'zustand'
import type { AuthUser } from '@axy/shared'
import { api } from '@/lib/api-client'
import { wsClient } from '@/lib/ws-client'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isPendingApproval: boolean

  login: (provider?: 'github') => Promise<string>
  devLogin: () => Promise<void>
  handleCallback: (code: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  restoreSession: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isPendingApproval: false,

  login: async () => {
    const data = await api.post<{ url: string }>('/api/auth/login', {
      redirectUrl: `${window.location.origin}/callback`,
    })
    return data.url
  },

  devLogin: async () => {
    const data = await api.post<{ token: string; user: AuthUser }>('/api/auth/dev-login', {})
    localStorage.setItem('axy_token', data.token)
    api.setToken(data.token)
    wsClient.setToken(data.token)
    set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false })
  },

  handleCallback: async (code) => {
    const data = await api.post<{ token: string; user: AuthUser }>('/api/auth/callback', { code })
    localStorage.setItem('axy_token', data.token)
    api.setToken(data.token)
    wsClient.setToken(data.token)

    // Check if user is approved
    if (data.user.isApproved === false) {
      set({ user: data.user, token: data.token, isAuthenticated: false, isPendingApproval: true, isLoading: false })
      return
    }
    set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false })
  },

  logout: () => {
    localStorage.removeItem('axy_token')
    api.setToken(null)
    wsClient.setToken(null)
    set({ user: null, token: null, isAuthenticated: false })
  },

  loadUser: async () => {
    try {
      const user = await api.get<AuthUser>('/api/auth/me')
      if (user.isApproved === false) {
        set({ user, isAuthenticated: false, isPendingApproval: true, isLoading: false })
        return
      }
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('pending approval')) {
        set({ isAuthenticated: false, isPendingApproval: true, isLoading: false })
        return
      }
      get().logout()
      set({ isLoading: false })
    }
  },

  restoreSession: () => {
    const token = localStorage.getItem('axy_token')
    if (token) {
      api.setToken(token)
      wsClient.setToken(token)
      set({ token })
      get().loadUser()
    } else {
      set({ isLoading: false })
    }
  },
}))
