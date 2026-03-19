import { create } from 'zustand'

interface TerminalSession {
  id: string
  projectId: string
  createdAt: number
}

interface TerminalState {
  /** Active terminal sessions per project */
  sessions: Record<string, TerminalSession> // projectId -> session
  /** Whether the terminal panel is visible in split view */
  panelOpen: Record<string, boolean> // projectId -> open
  /** Panel width percentage */
  panelWidth: number

  setSession: (projectId: string, session: TerminalSession | null) => void
  togglePanel: (projectId: string) => void
  setPanelOpen: (projectId: string, open: boolean) => void
  setPanelWidth: (width: number) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: {},
  panelOpen: {},
  panelWidth: 45,

  setSession: (projectId, session) =>
    set((s) => ({
      sessions: session
        ? { ...s.sessions, [projectId]: session }
        : Object.fromEntries(Object.entries(s.sessions).filter(([k]) => k !== projectId)),
    })),

  togglePanel: (projectId) =>
    set((s) => ({
      panelOpen: { ...s.panelOpen, [projectId]: !s.panelOpen[projectId] },
    })),

  setPanelOpen: (projectId, open) =>
    set((s) => ({
      panelOpen: { ...s.panelOpen, [projectId]: open },
    })),

  setPanelWidth: (width) => set({ panelWidth: Math.max(20, Math.min(80, width)) }),
}))
