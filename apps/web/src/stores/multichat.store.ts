import { create } from 'zustand'

interface MultiChatState {
  /** Whether multichat mode is active */
  isActive: boolean
  /** The secondary session ID shown in the right panel */
  secondarySessionId: string | null
  /** Split ratio (percentage for left panel) */
  splitRatio: number

  enable: (secondarySessionId: string) => void
  disable: () => void
  setSecondarySession: (sessionId: string) => void
  setSplitRatio: (ratio: number) => void
}

export const useMultiChatStore = create<MultiChatState>((set) => ({
  isActive: false,
  secondarySessionId: null,
  splitRatio: 50,

  enable: (secondarySessionId) => set({ isActive: true, secondarySessionId }),
  disable: () => set({ isActive: false, secondarySessionId: null }),
  setSecondarySession: (sessionId) => set({ secondarySessionId: sessionId }),
  setSplitRatio: (ratio) => set({ splitRatio: Math.max(25, Math.min(75, ratio)) }),
}))
