import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminOnlyRoute } from "#/components/RouteGuards";
import { api } from "../../convex/_generated/api";
import { formatPrice } from "#/lib/format";
import { useSessionStore } from "#/stores/sessionStore";
import { toast } from "#/stores/toastStore";

export const Route = createFileRoute("/admin/posters")({
  component: AdminManagePostersPage,
});

type FilterMode = "active" | "inactive";

function AdminManagePostersPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== "/admin/posters") {
    return (
      <AdminOnlyRoute>
        <Outlet />
      </AdminOnlyRoute>
    );
  }

  return (
    <AdminOnlyRoute>
      <AdminManagePostersContent />
    </AdminOnlyRoute>
  );
}

function AdminManagePostersContent() {
  const session = useSessionStore((state) => state.session);
  const updatePoster = useMutation(api.posters.updatePoster);
  const deletePoster = useMutation(api.posters.deletePoster);

  const [filterMode, setFilterMode] = useState<FilterMode>("active");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const posters = useQuery(
    api.posters.getAdminPosters,
    session?.role === "admin"
      ? {
          actorAuthUserId: session.authUserId,
          paginationOpts: { numItems: 100, cursor: null },
          isActive: filterMode === "active",
          category: categoryFilter.trim() ? categoryFilter.trim() : undefined,
          search: searchFilter.trim() ? searchFilter.trim() : undefined,
        }
      : "skip",
  );

  async function onDeactivate(posterId: Id<"posters">) {
    if (!session || session.role !== "admin") {
      return;
    }

    setActionError(null);

    try {
      await deletePoster({
        actorAuthUserId: session.authUserId,
        posterId,
      });
      toast.success("Poster deactivated");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to deactivate poster";
      setActionError(message);
      toast.error("Action failed", message);
    }
  }

  async function onActivate(posterId: Id<"posters">) {
    if (!session || session.role !== "admin") {
      return;
    }

    setActionError(null);

    try {
      await updatePoster({
        actorAuthUserId: session.authUserId,
        posterId,
        isActive: true,
      });
      toast.success("Poster activated");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to activate poster";
      setActionError(message);
      toast.error("Action failed", message);
    }
  }

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell rounded-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="island-kicker mb-2">Admin</p>
            <h1 className="m-0 text-3xl font-bold">Manage posters</h1>
            <p className="mt-3 text-sm text-[var(--sea-ink-soft)]">
              Review inventory, pricing, and listing status.
            </p>
          </div>

          <Link to="/admin/posters/new" className="btn-primary">
            Create poster
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select
            value={filterMode}
            onChange={(event) =>
              setFilterMode(event.target.value as FilterMode)
            }
            className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="active">Active posters</option>
            <option value="inactive">Inactive posters</option>
          </select>

          <input
            placeholder="Filter by category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
          />

          <input
            placeholder="Search title or description"
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            className="min-w-[220px] flex-1 rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        {actionError ? (
          <p className="mt-4 text-sm text-rose-300">{actionError}</p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Poster</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posters === undefined ? (
                <tr>
                  <td
                    className="px-4 py-6 text-[var(--sea-ink-soft)]"
                    colSpan={6}
                  >
                    Loading inventory...
                  </td>
                </tr>
              ) : posters.page.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-[var(--sea-ink-soft)]"
                    colSpan={6}
                  >
                    No posters found for this filter.
                  </td>
                </tr>
              ) : (
                posters.page.map((poster) => (
                  <tr
                    key={poster._id}
                    className="border-t border-[var(--line)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={poster.imageUrl}
                          alt={poster.title}
                          className="h-12 w-10 rounded-md object-cover"
                        />
                        <div>
                          <p className="m-0 font-semibold">{poster.title}</p>
                          <p className="m-0 text-xs text-[var(--sea-ink-soft)] line-clamp-1">
                            {poster.description}
                          </p>
                          <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                            {poster.images?.length ?? 0} images
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--sea-ink-soft)]">
                      {poster.category}
                    </td>
                    <td className="px-4 py-3">{formatPrice(poster.price)}</td>
                    <td className="px-4 py-3">
                      {(poster.sizeInventory ?? []).length === 0 ? (
                        <span className="text-xs text-[var(--sea-ink-soft)]">
                          Not configured
                        </span>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {(poster.sizeInventory ?? []).map((entry) => (
                              <span
                                key={entry.size}
                                className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.08em] ${
                                  entry.stock > 0
                                    ? "border-emerald-400/30 text-emerald-500"
                                    : "border-rose-400/20 text-rose-400"
                                }`}
                              >
                                {entry.size}: {entry.stock}
                              </span>
                            ))}
                          </div>

                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {poster.isActive ? (
                        <span className="rounded-full border border-emerald-400/30 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--sea-ink-soft)]">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to="/admin/posters/$posterId/edit"
                          params={{ posterId: poster._id }}
                          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
                        >
                          Edit
                        </Link>

                        {poster.isActive ? (
                          <button
                            type="button"
                            onClick={() => onDeactivate(poster._id)}
                            className="rounded-md border border-rose-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-red-400"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onActivate(poster._id)}
                            className="rounded-md border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-500"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
