import { Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AdminOnlyRoute } from '#/components/RouteGuards'

export const Route = createFileRoute('/admin')({
  component: AdminRouteRedirectPage,
})

function AdminRouteRedirectPage() {
  return (
    <AdminOnlyRoute>
      <AdminRouteRedirectContent />
    </AdminOnlyRoute>
  )
}

function AdminRouteRedirectContent() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    if (pathname !== '/admin') {
      return
    }

    void navigate({ to: '/admin/orders', replace: true })
  }, [navigate, pathname])

  if (pathname !== '/admin') {
    return <Outlet />
  }

  return (
    <main className="page-wrap px-4 py-10">
      <p className="text-sm text-[var(--sea-ink-soft)]">Redirecting to Track Orders...</p>
    </main>
  )
}
