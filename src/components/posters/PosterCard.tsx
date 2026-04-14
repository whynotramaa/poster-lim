import { Link } from '@tanstack/react-router'
import type { Doc } from '../../../convex/_generated/dataModel'
import { formatPrice } from '#/lib/format'

type PosterCardProps = {
  poster: Doc<'posters'>
  onAddToCart: (poster: Doc<'posters'>) => void
}

export function PosterCard({ poster, onAddToCart }: PosterCardProps) {
  const badge =
    poster.popularityScore >= 25 ? 'EXCL' : poster.popularityScore <= 8 ? 'NEW' : null
  const hasAvailableStock =
    !poster.sizeInventory || poster.sizeInventory.some((entry) => entry.stock > 0)

  return (
    <article className="product-card p-3">
      <div className="product-image-wrap mb-3">
        {badge ? (
          <span className={`poster-badge ${badge === 'NEW' ? 'is-new' : 'is-excl'}`}>
            {badge}
          </span>
        ) : null}
        <img
          src={poster.imageUrl}
          alt={poster.title}
          className="h-64 w-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--sea-ink-soft)] uppercase">
            {poster.category}
          </p>
          <h3 className="m-0 mt-1 text-base font-semibold text-[var(--sea-ink)]">{poster.title}</h3>
        </div>
        <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
          {formatPrice(poster.price)}
        </p>
      </div>

      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--sea-ink-soft)]">
        {poster.description}
      </p>

      <div className="flex items-center gap-2">
        <Link
          to="/poster/$posterId"
          params={{ posterId: poster._id }}
          className="cta-link"
        >
          View
        </Link>
        <button
          type="button"
          disabled={!hasAvailableStock}
          onClick={() => onAddToCart(poster)}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold tracking-[0.08em] text-[var(--sea-ink)] uppercase disabled:opacity-50"
        >
          {hasAvailableStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </article>
  )
}
