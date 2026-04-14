import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

type ToastItem = {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

type ToastStore = {
  toasts: ToastItem[]
  pushToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
}

function makeToastId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { id: makeToastId(), ...toast }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}))

export const toast = {
  success: (title: string, description?: string) => {
    useToastStore.getState().pushToast({ title, description, tone: 'success' })
  },
  error: (title: string, description?: string) => {
    useToastStore.getState().pushToast({ title, description, tone: 'error' })
  },
  info: (title: string, description?: string) => {
    useToastStore.getState().pushToast({ title, description, tone: 'info' })
  },
}
