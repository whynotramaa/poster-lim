import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { CustomerOnlyRoute } from '#/components/RouteGuards'
import { formatPrice } from '#/lib/format'
import { getCartTotal, useCartStore } from '#/stores/cartStore'
import { useSessionStore } from '#/stores/sessionStore'

export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
})

function CheckoutPage() {
  return (
    <CustomerOnlyRoute>
      <CheckoutContent />
    </CustomerOnlyRoute>
  )
}

function CheckoutContent() {
  const navigate = useNavigate()
  const session = useSessionStore((state) => state.session)
  const items = useCartStore((state) => state.items)
  const clearCart = useCartStore((state) => state.clearCart)
  const createOrder = useMutation(api.orders.createOrder)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null)

  const [line1, setLine1] = useState('')
  const [city, setCity] = useState('')
  const [stateValue, setStateValue] = useState('')
  const [pincode, setPincode] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <main className="page-wrap px-4 py-10">
        <section className="island-shell rounded-2xl p-6">
          <h1 className="m-0 text-3xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
            Add posters to cart before checkout.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold">
            Browse posters
          </Link>
        </section>
      </main>
    )
  }

  const total = getCartTotal(items)
  const couponPreview = useQuery(
    api.coupons.previewCoupon,
    appliedCouponCode
      ? {
          code: appliedCouponCode,
          subtotalAmount: total,
        }
      : 'skip',
  )
  const discountAmount = couponPreview?.discountAmount ?? 0
  const finalAmount = couponPreview?.totalAmount ?? total

  function applyCoupon() {
    const normalized = couponInput.trim().toUpperCase()
    if (!normalized) {
      setError('Enter a coupon code')
      return
    }
    setError(null)
    setAppliedCouponCode(normalized)
  }

  function removeCoupon() {
    setAppliedCouponCode(null)
    setCouponInput('')
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (!session?.authUserId) {
        throw new Error('Please log in to place your order')
      }

      await createOrder({
        authUserId: session.authUserId,
        items: items.map((item) => ({
          posterId: item.posterId as Id<'posters'>,
          selectedSize: item.selectedSize,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        shippingAddress: {
          line1,
          city,
          state: stateValue,
          pincode,
          phone,
        },
        couponCode: appliedCouponCode ?? undefined,
      })

      clearCart()
      await navigate({ to: '/account/orders' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={onSubmit} className="island-shell rounded-md p-6">
          <p className="island-kicker mb-2">Checkout</p>
          <h1 className="m-0 text-3xl font-bold">Shipping details</h1>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
                Address Line 1
              </span>
              <input
                required
                value={line1}
                onChange={(event) => setLine1(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
                City
              </span>
              <input
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
                State
              </span>
              <input
                required
                value={stateValue}
                onChange={(event) => setStateValue(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
                Pincode
              </span>
              <input
                required
                value={pincode}
                onChange={(event) => setPincode(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
                Phone
              </span>
              <input
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary mt-6 disabled:opacity-60"
          >
            {submitting ? 'Placing order...' : 'Place Order'}
          </button>
        </form>

        <aside className="island-shell rounded-md p-6">
          <p className="island-kicker mb-2">Summary</p>
          <h2 className="m-0 text-2xl font-bold">Order total</h2>

          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div
                key={`${item.posterId}-${item.selectedSize ?? 'default'}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-[var(--sea-ink-soft)]">
                  {item.title}
                  {item.selectedSize ? ` (${item.selectedSize})` : ''} x {item.quantity}
                </span>
                <strong>{formatPrice(item.price * item.quantity)}</strong>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
              Coupon code
            </p>
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value)}
                placeholder="Enter coupon"
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm uppercase"
              />
              <button
                type="button"
                onClick={applyCoupon}
                className="rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase"
              >
                Apply
              </button>
            </div>

            {appliedCouponCode ? (
              couponPreview === null ? (
                <p className="mt-2 text-xs text-rose-300">
                  Invalid or inactive coupon code.
                </p>
              ) : couponPreview ? (
                <div className="mt-2 flex items-center justify-between text-xs text-emerald-300">
                  <span>
                    Applied {couponPreview.code}
                    {' '}
                    ({couponPreview.discountType === 'percentage'
                      ? `${couponPreview.discountValue}%`
                      : formatPrice(couponPreview.discountValue)})
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--sea-ink-soft)]">Checking coupon...</p>
              )
            ) : null}
          </div>

          <div className="mt-5 space-y-2 border-t border-[var(--line)] pt-4">
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              Subtotal: {formatPrice(total)}
            </p>
            {discountAmount > 0 ? (
              <p className="m-0 text-sm text-emerald-300">
                Discount: -{formatPrice(discountAmount)}
              </p>
            ) : null}
            <p className="m-0 text-lg font-semibold">
              Total: {formatPrice(finalAmount)}
            </p>
          </div>
        </aside>
      </section>
    </main>
  )
}
