import { create } from 'zustand'
import { api } from '@/lib/api-client'
import type { ConnectedAccount, ConnectedAccountType, CreateConnectedAccountInput, UpdateConnectedAccountInput } from '@axy/shared'

interface AccountState {
  accounts: ConnectedAccount[]
  isLoading: boolean
  error: string | null

  fetchAccounts: (type?: ConnectedAccountType) => Promise<void>
  createAccount: (input: CreateConnectedAccountInput) => Promise<ConnectedAccount>
  updateAccount: (id: string, input: UpdateConnectedAccountInput) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  testAccount: (id: string) => Promise<{ valid: boolean; username?: string }>
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,

  fetchAccounts: async (type) => {
    set({ isLoading: true, error: null })
    try {
      const query = type ? `?type=${type}` : ''
      const accounts = await api.get<ConnectedAccount[]>(`/api/accounts${query}`)
      set({ accounts, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  createAccount: async (input) => {
    const account = await api.post<ConnectedAccount>('/api/accounts', input)
    await get().fetchAccounts()
    return account
  },

  updateAccount: async (id, input) => {
    await api.put<ConnectedAccount>(`/api/accounts/${id}`, input)
    await get().fetchAccounts()
  },

  deleteAccount: async (id) => {
    await api.delete(`/api/accounts/${id}`)
    await get().fetchAccounts()
  },

  testAccount: async (id) => {
    return api.post<{ valid: boolean; username?: string }>(`/api/accounts/${id}/test`)
  },
}))
