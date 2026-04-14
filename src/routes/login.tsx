import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  UNIVERSAL_ADMIN_PASSWORD,
  isUniversalAdminEmail,
} from '#/lib/adminAuth'
import { useSessionStore } from '#/stores/sessionStore'

type LoginSearch = {
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const convex = useConvex()
  const syncUser = useMutation(api.users.syncUser)
  const setSession = useSessionStore((state) => state.setSession)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function withFetchRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      if (!message.includes('fetch failed')) {
        throw error
      }

      return await operation()
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (isUniversalAdminEmail(email) && password !== UNIVERSAL_ADMIN_PASSWORD) {
      setError('Admin password is invalid for this account')
      return
    }

    setSubmitting(true)

    try {
      const { authClient } = await import('#/lib/auth-client')
      let result

      if (isUniversalAdminEmail(email) && password === UNIVERSAL_ADMIN_PASSWORD) {
        const bootstrapName = email.split('@')[0] || 'Admin'
        const signup = await withFetchRetry(() =>
          authClient.signUp.email({
            email,
            password,
            name: bootstrapName,
          }),
        )
        if (signup.error) {
          const normalized = signup.error.message.toLowerCase()
          const isAlreadyExistsError =
            normalized.includes('already') || normalized.includes('exists')
          if (!isAlreadyExistsError) {
            throw new Error(signup.error.message)
          }
        }
        result = await withFetchRetry(() =>
          authClient.signIn.email({
            email,
            password,
          }),
        )
      } else {
        result = await withFetchRetry(() =>
          authClient.signIn.email({
            email,
            password,
          }),
        )
      }

      if (result.error) {
        throw new Error(result.error.message)
      }

      const authUser = result.data?.user
      if (!authUser?.id || !authUser.email) {
        throw new Error('Unable to resolve authenticated user')
      }

      const fallbackName =
        (typeof authUser.name === 'string' && authUser.name.trim()) ||
        authUser.email.split('@')[0] ||
        'User'

      await syncUser({
        authUserId: authUser.id,
        email: authUser.email,
        name: fallbackName,
      })

      const user = await convex.query(api.users.getUserByAuthId, {
        authUserId: authUser.id,
      })

      if (!user) {
        throw new Error('Unable to load user profile from Convex')
      }

      const resolvedEmail = user.email
      const resolvedRole = user.role

      setSession({
        authUserId: authUser.id,
        email: resolvedEmail,
        name: user.name || fallbackName,
        role: resolvedRole,
      })

      if (resolvedRole === 'admin') {
        await navigate({ to: '/admin/orders' })
        return
      }

      if (search.redirect) {
        window.location.assign(search.redirect)
        return
      }

      await navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell mx-auto w-full max-w-xl rounded-2xl p-6">
        <p className="island-kicker mb-2">Auth</p>
        <h1 className="m-0 text-3xl font-bold">Login</h1>
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
          Login with your email and password. Your user is synced into Convex automatically.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
              Email
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
              Password
            </span>
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-sm text-[var(--sea-ink-soft)]">
          New user? <Link to="/signup">Create account</Link>
        </p>
      </section>
    </main>
  )
}
