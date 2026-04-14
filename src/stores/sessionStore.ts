import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export type SessionRole = 'customer' | 'admin'

export type AppSession = {
  authUserId: string
  email: string
  name: string
  role: SessionRole
}

type SessionState = {
  session: AppSession | null
  setSession: (session: AppSession) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: 'poster-lim-session',
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? noopStorage : localStorage,
      ),
    },
  ),
)
