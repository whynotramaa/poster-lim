import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  UNIVERSAL_ADMIN_PASSWORD,
  isUniversalAdminEmail,
} from '#/lib/adminAuth'
import { useSessionStore } from '#/stores/sessionStore'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const convex = useConvex()
  const syncUser = useMutation(api.users.syncUser)
  const setSession = useSessionStore((state) => state.setSession)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (isUniversalAdminEmail(email) && password !== UNIVERSAL_ADMIN_PASSWORD) {
      setError('This admin email must use the configured admin password')
      return
    }

    setSubmitting(true)

    try {
      const { authClient } = await import('#/lib/auth-client')
      const result = await withFetchRetry(() =>
        authClient.signUp.email({
          email,
          password,
          name,
        }),
      )

      if (result.error) {
        throw new Error(result.error.message)
      }

      const authUser = result.data?.user
      if (!authUser?.id || !authUser.email) {
        throw new Error('Unable to resolve created user')
      }

      await syncUser({
        authUserId: authUser.id,
        email: authUser.email,
        name,
      })

      const user = await convex.query(api.users.getUserByAuthId, {
        authUserId: authUser.id,
      })

      if (!user) {
        throw new Error('Unable to load user profile from Convex')
      }

      const resolvedEmail = user.email

      setSession({
        authUserId: authUser.id,
        email: resolvedEmail,
        name: user.name || name,
        role: user.role,
      })

      if (user.role === 'admin') {
        await navigate({ to: '/admin/orders' })
        return
      }

      await navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell mx-auto w-full max-w-xl rounded-2xl p-6">
        <p className="island-kicker mb-2">Auth</p>
        <h1 className="m-0 text-3xl font-bold">Create account</h1>

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

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
              Confirm Password
            </span>
            <input
              required
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
              Name
            </span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary disabled:opacity-60"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-sm text-[var(--sea-ink-soft)]">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  )
}
