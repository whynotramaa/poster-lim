import { createFileRoute, Link } from '@tanstack/react-router'
import { formatPrice } from '#/lib/format'
import { getCartTotal, useCartStore } from '#/stores/cartStore'
import { useHydrated } from '#/hooks/useHydrated'

export const Route = createFileRoute('/cart')({
  component: CartPage,
})

function CartPage() {
  const hydrated = useHydrated()
  const items = useCartStore((state) => state.items)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const clearCart = useCartStore((state) => state.clearCart)

  if (!hydrated) {
    return (
      <main className="page-wrap px-4 py-10">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading cart...</p>
      </main>
    )
  }

  const total = getCartTotal(items)

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell rounded-md p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="island-kicker mb-2">Cart</p>
            <h1 className="m-0 text-3xl font-bold">Your cart</h1>
          </div>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={clearCart}
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold tracking-[0.08em] uppercase"
            >
              Clear cart
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center">
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Your cart is empty.</p>
            <Link to="/" className="mt-3 inline-block text-sm font-semibold">
              Browse posters
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((item) => (
                <article
                  key={`${item.posterId}-${item.selectedSize ?? 'default'}`}
                  className="flex flex-col gap-4 rounded-md border border-[var(--line)] p-4 sm:flex-row sm:items-center"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-20 w-full rounded-md object-cover sm:w-28"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-base font-semibold">{item.title}</p>
                    {item.selectedSize ? (
                      <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">Size: {item.selectedSize}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">{formatPrice(item.price)}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        updateQuantity(
                          item.posterId,
                          Math.max(1, Number(event.target.value) || 1),
                          item.selectedSize,
                        )
                      }
                      className="w-20 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.posterId, item.selectedSize)}
                      className="rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold tracking-[0.08em] uppercase"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center">
              <p className="m-0 text-lg font-semibold">Total: {formatPrice(total)}</p>
              <Link to="/checkout" className="cta-link">
                Proceed to Checkout
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
