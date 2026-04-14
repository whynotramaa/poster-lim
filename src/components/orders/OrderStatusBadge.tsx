type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered'

const statusStyles: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/12 text-amber-300 border-amber-300/30',
  processing: 'bg-sky-500/12 text-sky-300 border-sky-300/30',
  shipped: 'bg-indigo-500/14 text-indigo-300 border-indigo-300/30',
  delivered: 'bg-emerald-500/12 text-emerald-300 border-emerald-300/30',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${statusStyles[status]}`}
    >
      {status}
    </span>
  )
}
