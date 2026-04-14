import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export type CartItem = {
  posterId: string
  title: string
  imageUrl: string
  price: number
  quantity: number
  selectedSize?: string
}

function isSameCartLine(a: CartItem, b: CartItem) {
  return a.posterId === b.posterId && (a.selectedSize ?? null) === (b.selectedSize ?? null)
}

type CartState = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (posterId: string, selectedSize?: string) => void
  updateQuantity: (posterId: string, quantity: number, selectedSize?: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((entry) => isSameCartLine(entry, item))
          if (!existing) {
            return { items: [...state.items, item] }
          }

          return {
            items: state.items.map((entry) =>
              isSameCartLine(entry, item)
                ? { ...entry, quantity: entry.quantity + item.quantity }
                : entry,
            ),
          }
        }),
      removeItem: (posterId, selectedSize) =>
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.posterId === posterId && (item.selectedSize ?? null) === (selectedSize ?? null)),
          ),
        })),
      updateQuantity: (posterId, quantity, selectedSize) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter(
                  (item) => !(item.posterId === posterId && (item.selectedSize ?? null) === (selectedSize ?? null)),
                )
              : state.items.map((item) =>
                  item.posterId === posterId && (item.selectedSize ?? null) === (selectedSize ?? null)
                    ? { ...item, quantity }
                    : item,
                ),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'poster-lim-cart',
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? noopStorage : localStorage,
      ),
    },
  ),
)

export function getCartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
