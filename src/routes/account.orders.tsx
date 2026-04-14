import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { formatDate, formatPrice } from '#/lib/format'
import { OrderStatusBadge } from '#/components/orders/OrderStatusBadge'
import { CustomerOnlyRoute } from '#/components/RouteGuards'
import { useSessionStore } from '#/stores/sessionStore'

export const Route = createFileRoute('/account/orders')({
  component: AccountOrdersPage,
})

function AccountOrdersPage() {
  return (
    <CustomerOnlyRoute>
      <AccountOrdersContent />
    </CustomerOnlyRoute>
  )
}

function AccountOrdersContent() {
  const session = useSessionStore((state) => state.session)
  const isCustomer = session ? session.role !== 'admin' : false

  const orders = useQuery(
    api.orders.getUserOrders,
    session && isCustomer
      ? {
          authUserId: session.authUserId,
          paginationOpts: { numItems: 25, cursor: null },
        }
      : 'skip',
  )

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell rounded-2xl p-6">
        <p className="island-kicker mb-2">Account</p>
        <h1 className="m-0 text-3xl font-bold">Order history</h1>

        {orders === undefined ? (
          <p className="mt-4 text-sm text-[var(--sea-ink-soft)]">Loading orders...</p>
        ) : orders.page.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--sea-ink-soft)]">No orders yet.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.page.map((order) => (
              <article key={order._id} className="rounded-xl border border-[var(--line)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-sm font-semibold">Order #{order._id.slice(-6)}</p>
                  <OrderStatusBadge status={order.status} />
                </div>

                <div className="mt-2 text-sm text-[var(--sea-ink-soft)]">
                  <p className="m-0">Placed: {formatDate(order.createdAt)}</p>
                  <p className="m-0">Items: {order.items.length}</p>
                </div>

                <div className="mt-2 space-y-1 text-xs text-[var(--sea-ink-soft)]">
                  {order.items.slice(0, 2).map((item, index) => (
                    <p key={`${order._id}-item-${index}`} className="m-0">
                      Qty {item.quantity}
                      {item.selectedSize ? ` • Size ${item.selectedSize}` : ''}
                    </p>
                  ))}
                  {order.items.length > 2 ? (
                    <p className="m-0">+{order.items.length - 2} more line items</p>
                  ) : null}
                </div>

                <p className="mt-3 text-base font-semibold">{formatPrice(order.totalAmount)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
