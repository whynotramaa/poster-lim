import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { RiInstagramLine, RiFacebookLine, RiTwitterXLine } from '@remixicon/react'
import { api } from '../../convex/_generated/api'
import { PosterCard } from '#/components/posters/PosterCard'
import { useCartStore } from '#/stores/cartStore'

const pageSize = 24

export const Route = createFileRoute('/')({ component: BrowsePage })

interface FiltersPanelProps {
  search: string
  onSearchChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  categories: string[] | undefined
  sort: 'newest' | 'popular' | 'priceAsc' | 'priceDesc'
  onSortChange: (value: 'newest' | 'popular' | 'priceAsc' | 'priceDesc') => void
  minPrice: string
  onMinPriceChange: (value: string) => void
  maxPrice: string
  onMaxPriceChange: (value: string) => void
}

function FiltersPanel({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  sort,
  onSortChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
}: FiltersPanelProps) {
  return (
    <>
      <div className="space-y-4">
        <label className="block">
          <span className="filter-title">Search</span>
          <input
            placeholder="Search posters"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="filter-input"
          />
        </label>

        <div>
          <p className="filter-title">Category</p>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => onCategoryChange('')}
              className={`filter-option ${category === '' ? 'is-selected' : ''}`}
            >
              <span>All</span>
            </button>
            {categories && categories.map((entry) => (
              <button
                type="button"
                key={entry}
                onClick={() => onCategoryChange(entry)}
                className={`filter-option ${category === entry ? 'is-selected' : ''}`}
              >
                <span>{entry}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="filter-title">Sort</span>
          <select
            value={sort}
            onChange={(event) =>
              onSortChange(
                event.target.value as 'newest' | 'popular' | 'priceAsc' | 'priceDesc',
              )
            }
            className="filter-input"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most popular</option>
            <option value="priceAsc">Price: low to high</option>
            <option value="priceDesc">Price: high to low</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="filter-title">Min</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0"
              value={minPrice}
              onChange={(event) => onMinPriceChange(event.target.value)}
              className="filter-input"
            />
          </label>
          <label>
            <span className="filter-title">Max</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="9999"
              value={maxPrice}
              onChange={(event) => onMaxPriceChange(event.target.value)}
              className="filter-input"
            />
          </label>
        </div>
      </div>
    </>
  )
}

function BrowsePage() {
  const addItem = useCartStore((state) => state.addItem)
  const [category, setCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'newest' | 'popular' | 'priceAsc' | 'priceDesc'>(
    'newest',
  )
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Dynamically fetch categories from database
  const categories = useQuery(api.posters.getCategories, {})

  // Fetch settings for cover image and ticker
  const settings = useQuery(api.settings.getSettings, {})

  const posters = useQuery(api.posters.getPosters, {
    paginationOpts: { numItems: pageSize, cursor: null },
    category: category || undefined,
    search: search.trim() || undefined,
    minPrice: minPrice ? Math.round(Number(minPrice) * 100) : undefined,
    maxPrice: maxPrice ? Math.round(Number(maxPrice) * 100) : undefined,
    sort,
  })

  // Memoize FiltersPanel props to prevent unnecessary re-renders
  const filtersPanelProps = useMemo(
    () => ({
      search,
      onSearchChange: setSearch,
      category,
      onCategoryChange: setCategory,
      categories,
      sort,
      onSortChange: setSort,
      minPrice,
      onMinPriceChange: setMinPrice,
      maxPrice,
      onMaxPriceChange: setMaxPrice,
    }),
    [search, category, categories, sort, minPrice, maxPrice],
  )

  const heroStyle = {
    backgroundImage: `linear-gradient(90deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.2) 100%), url('${settings?.coverImageUrl || "/cover.png"}')`,
  }

  return (
    <main className="page-wrap px-4 pb-14 pt-8 sm:pt-10">
      <section className="hero-editorial rise-in" style={heroStyle}>
        <p className="hero-eyebrow">Collector edits for modern walls</p>
        <h1 className="hero-title">POSTER LIM</h1>
        <div className="hero-socials">
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors" title="Follow us on Instagram">
            <RiInstagramLine size={18} />
            <span>Instagram</span>
          </a>
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors" title="Follow us on Facebook">
            <RiFacebookLine size={18} />
            <span>Facebook</span>
          </a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors" title="Follow us on Twitter">
            <RiTwitterXLine size={18} />
            <span>Twitter</span>
          </a>
        </div>
      </section>

      <section className="mt-8 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold tracking-[0.1em] uppercase"
        >
          Filters & Sort
        </button>
      </section>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35 lg:hidden">
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="m-0 text-lg font-semibold tracking-[0.04em] uppercase">Filters</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="text-xs font-semibold tracking-[0.1em] uppercase"
              >
                Close
              </button>
            </div>
            <FiltersPanel {...filtersPanelProps} />
          </div>
        </div>
      ) : null}

      <section className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-36 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <FiltersPanel {...filtersPanelProps} />
          </div>
        </aside>

        <div id="browse-grid">
          {posters === undefined ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">Loading posters...</p>
          ) : posters.page.length === 0 ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">No posters found.</p>
          ) : (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posters.page.map((poster) => (
                <PosterCard
                  key={poster._id}
                  poster={poster}
                  onAddToCart={(selectedPoster) =>
                    addItem({
                      posterId: selectedPoster._id,
                      title: selectedPoster.title,
                      imageUrl: selectedPoster.imageUrl,
                      price: selectedPoster.price,
                      quantity: 1,
                      selectedSize: selectedPoster.sizeInventory?.find((entry) => entry.stock > 0)?.size,
                    })
                  }
                />
              ))}
            </section>
          )}
        </div>
      </section>
    </main>
  )
}
