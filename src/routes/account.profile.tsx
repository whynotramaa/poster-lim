import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { CustomerOnlyRoute } from '#/components/RouteGuards'
import { useSessionStore } from '#/stores/sessionStore'

export const Route = createFileRoute('/account/profile')({
  component: AccountProfilePage,
})

function AccountProfilePage() {
  return (
    <CustomerOnlyRoute>
      <AccountProfileContent />
    </CustomerOnlyRoute>
  )
}

function AccountProfileContent() {
  const session = useSessionStore((state) => state.session)
  const setSession = useSessionStore((state) => state.setSession)
  const updateOwnProfile = useMutation(api.users.updateOwnProfile)

  const [name, setName] = useState(session?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      await updateOwnProfile({
        authUserId: session.authUserId,
        name,
      })

      setSession({ ...session, name })
      setMessage('Profile updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell mx-auto max-w-xl rounded-2xl p-6">
        <p className="island-kicker mb-2">Account</p>
        <h1 className="m-0 text-3xl font-bold">Profile</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
              Email
            </span>
            <input
              value={session.email}
              disabled
              className="w-full rounded-xl border border-[var(--line)] bg-black/10 px-3 py-2.5 opacity-80"
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

          <p className="text-sm text-[var(--sea-ink-soft)]">
            Role: {session.role}
          </p>

          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </section>
    </main>
  )
}
