import { createFileRoute, notFound } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { AdminOnlyRoute } from '#/components/RouteGuards'
import PosterEditorForm from '#/components/admin/PosterEditorForm'
import { api } from '../../convex/_generated/api'
import { useSessionStore } from '#/stores/sessionStore'

export const Route = createFileRoute('/admin/posters/$posterId/edit')({
  component: AdminEditPosterPage,
})

function AdminEditPosterPage() {
  return (
    <AdminOnlyRoute>
      <AdminEditPosterContent />
    </AdminOnlyRoute>
  )
}

function AdminEditPosterContent() {
  const session = useSessionStore((state) => state.session)
  const { posterId } = Route.useParams()

  const poster = useQuery(
    api.posters.getAdminPosterById,
    session?.role === 'admin'
      ? {
          actorAuthUserId: session.authUserId,
          posterId,
        }
      : 'skip',
  )

  if (poster === undefined) {
    return (
      <main className="page-wrap px-4 py-10">
        <section className="island-shell rounded-2xl p-6">
          <p className="text-sm text-[var(--sea-ink-soft)]">Loading poster...</p>
        </section>
      </main>
    )
  }

  if (!poster) {
    throw notFound()
  }

  return (
    <main className="page-wrap px-4 py-10">
      <PosterEditorForm mode="edit" initialPoster={poster} />
    </main>
  )
}
