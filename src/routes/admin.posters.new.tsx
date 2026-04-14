import { createFileRoute } from '@tanstack/react-router'
import { AdminOnlyRoute } from '#/components/RouteGuards'
import PosterEditorForm from '#/components/admin/PosterEditorForm'

export const Route = createFileRoute('/admin/posters/new')({
  component: AdminCreatePosterPage,
})

function AdminCreatePosterPage() {
  return (
    <AdminOnlyRoute>
      <main className="page-wrap px-4 py-10">
        <PosterEditorForm mode="create" />
      </main>
    </AdminOnlyRoute>
  )
}
