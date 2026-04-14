import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { OrderStatusBadge } from '#/components/orders/OrderStatusBadge'
import { AdminOnlyRoute } from '#/components/RouteGuards'
import { formatDate, formatPrice } from '#/lib/format'
import { useSessionStore } from '#/stores/sessionStore'

const statuses = ['pending', 'processing', 'shipped', 'delivered'] as const

type OrderStatus = (typeof statuses)[number]

export const Route = createFileRoute('/admin/orders')({
  component: AdminOrdersPage,
})

function AdminOrdersPage() {
  return (
    <AdminOnlyRoute>
      <AdminOrdersContent />
    </AdminOnlyRoute>
  )
}

function AdminOrdersContent() {
  const session = useSessionStore((state) => state.session)
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus)

  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = session ? session.role === 'admin' : false

  const orders = useQuery(
    api.orders.getAllOrders,
    isAdmin && session
      ? {
          actorAuthUserId: session.authUserId,
          paginationOpts: { numItems: 40, cursor: null },
          status: statusFilter === 'all' ? undefined : statusFilter,
        }
      : 'skip',
  )
  const stats = useQuery(
    api.admin.getAdminStats,
    isAdmin && session
      ? { actorAuthUserId: session.authUserId }
      : 'skip',
  )

  async function onChangeStatus(orderId: string, nextStatus: OrderStatus) {
    if (!session) {
      return
    }

    setError(null)
    setUpdatingOrderId(orderId)

    try {
      await updateOrderStatus({
        actorAuthUserId: session.authUserId,
        orderId: orderId as Id<'orders'>,
        status: nextStatus,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <main className="page-wrap px-4 py-10">
      {stats === undefined ? (
        <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">Loading stats...</p>
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="island-shell rounded-xl p-4">
              <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">Revenue</p>
              <p className="mt-2 text-2xl font-bold">{formatPrice(stats.totalRevenue)}</p>
            </div>
            <div className="island-shell rounded-xl p-4">
              <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">Orders</p>
              <p className="mt-2 text-2xl font-bold">{stats.orderCount}</p>
            </div>
            <div className="island-shell rounded-xl p-4">
              <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">Delivered</p>
              <p className="mt-2 text-2xl font-bold">{stats.statusCounts.delivered ?? 0}</p>
            </div>
            <div className="island-shell rounded-xl p-4">
              <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">Processing</p>
              <p className="mt-2 text-2xl font-bold">{stats.statusCounts.processing ?? 0}</p>
            </div>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <article className="island-shell rounded-xl p-4">
              <h2 className="m-0 text-lg font-semibold">Top selling posters</h2>
              <div className="mt-3 space-y-3">
                {stats.topSellingPosters.length === 0 ? (
                  <p className="m-0 text-sm text-[var(--sea-ink-soft)]">No sales yet.</p>
                ) : (
                  stats.topSellingPosters.map((poster) => (
                    <div key={poster.posterId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{poster.title}</span>
                      <strong>{poster.quantitySold}</strong>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="island-shell rounded-xl p-4">
              <h2 className="m-0 text-lg font-semibold">Recent activity</h2>
              <div className="mt-3 space-y-3">
                {stats.recentActivity.length === 0 ? (
                  <p className="m-0 text-sm text-[var(--sea-ink-soft)]">No recent orders.</p>
                ) : (
                  stats.recentActivity.map((activity) => (
                    <div key={activity.orderId} className="rounded-lg border border-[var(--line)] p-3 text-sm">
                      <p className="m-0">Order #{activity.orderId.slice(-6)}</p>
                      <p className="m-0 text-[var(--sea-ink-soft)]">{activity.status}</p>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      )}

      <section className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="island-kicker mb-2">Admin</p>
          <h1 className="m-0 text-3xl font-bold">Order management</h1>
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderStatus)}
          className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm"
        >
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </section>

      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

      <section className="space-y-4">
        {orders === undefined ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">Loading orders...</p>
        ) : orders.page.length === 0 ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">No orders found.</p>
        ) : (
          orders.page.map((order) => (
            <article key={order._id} className="island-shell rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-sm font-semibold">Order #{order._id.slice(-6)}</p>
                  <p className="m-0 text-xs text-[var(--sea-ink-soft)]">{formatDate(order.createdAt)}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <p className="m-0 text-[var(--sea-ink-soft)]">Items: {order.items.length}</p>
                <p className="m-0 font-semibold">Final: {formatPrice(order.totalAmount)}</p>
                {order.subtotalAmount !== undefined ? (
                  <p className="m-0 text-[var(--sea-ink-soft)]">
                    Subtotal: {formatPrice(order.subtotalAmount)}
                  </p>
                ) : null}
                {order.discountAmount !== undefined && order.discountAmount > 0 ? (
                  <p className="m-0 text-emerald-300">
                    Discount: -{formatPrice(order.discountAmount)}
                    {order.couponCode ? ` (${order.couponCode})` : ''}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 space-y-1 text-xs text-[var(--sea-ink-soft)]">
                {order.items.slice(0, 3).map((item, index) => (
                  <p key={`${order._id}-item-${index}`} className="m-0">
                    Qty {item.quantity}
                    {item.selectedSize ? ` • Size ${item.selectedSize}` : ''}
                  </p>
                ))}
                {order.items.length > 3 ? (
                  <p className="m-0">+{order.items.length - 3} more line items</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {statuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={updatingOrderId === order._id || order.status === status}
                    onClick={() => onChangeStatus(order._id, status)}
                    className="rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}
