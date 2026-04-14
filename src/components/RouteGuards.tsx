import { useNavigate, useRouterState } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { useHydrated } from '#/hooks/useHydrated'
import { useSessionStore } from '#/stores/sessionStore'

type GuardShellProps = {
  title: string
  message: string
}

function GuardShell({ title, message }: GuardShellProps) {
  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell rounded-2xl p-6">
        <h1 className="m-0 text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">{message}</p>
      </section>
    </main>
  )
}

type RouteGuardProps = {
  children: ReactNode
}

export function AdminOnlyRoute({ children }: RouteGuardProps) {
  const hydrated = useHydrated()
  const navigate = useNavigate()
  const session = useSessionStore((state) => state.session)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    if (!hydrated) {
      return
    }

    if (!session) {
      void navigate({
        to: '/login',
        search: { redirect: pathname },
        replace: true,
      })
      return
    }

    if (session.role !== 'admin') {
      void navigate({ to: '/', replace: true })
    }
  }, [hydrated, navigate, pathname, session])

  if (!hydrated) {
    return <GuardShell title="Admin" message="Loading admin..." />
  }

  if (!session) {
    return <GuardShell title="Login required" message="Redirecting to login..." />
  }

  if (session.role !== 'admin') {
    return <GuardShell title="Admin only" message="Redirecting to marketplace..." />
  }

  return <>{children}</>
}

export function CustomerOnlyRoute({ children }: RouteGuardProps) {
  const hydrated = useHydrated()
  const navigate = useNavigate()
  const session = useSessionStore((state) => state.session)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    if (!hydrated) {
      return
    }

    if (!session) {
      void navigate({
        to: '/login',
        search: { redirect: pathname },
        replace: true,
      })
      return
    }

    if (session.role === 'admin') {
      void navigate({ to: '/admin/orders', replace: true })
    }
  }, [hydrated, navigate, pathname, session])

  if (!hydrated) {
    return <GuardShell title="Account" message="Loading account..." />
  }

  if (!session) {
    return <GuardShell title="Login required" message="Redirecting to login..." />
  }

  if (session.role === 'admin') {
    return <GuardShell title="Admin" message="Redirecting to admin area..." />
  }

  return <>{children}</>
}
