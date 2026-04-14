import { Link } from '@tanstack/react-router'
import { RiShoppingBag2Line, RiLogoutBoxRLine } from '@remixicon/react'
import Ticker from './Ticker'
import ThemeToggle from './ThemeToggle'
import { useHydrated } from '#/hooks/useHydrated'
import { useCartStore } from '#/stores/cartStore'
import { useSessionStore } from '#/stores/sessionStore'

export default function Header() {
  const hydrated = useHydrated()
  const cartCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  )
  const session = useSessionStore((state) => state.session)
  const clearSession = useSessionStore((state) => state.clearSession)
  const isAdminSession = hydrated && session
    ? session.role === 'admin'
    : false

  async function onLogout() {
    const { authClient } = await import('#/lib/auth-client')
    await authClient.signOut()
    clearSession()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-md">
      <nav className="page-wrap py-3">
        <div className="grid items-center gap-3 border-b border-[var(--line)] pb-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sea-ink-soft)] uppercase">
            NP / NRP
          </div>

          <h2 className="m-0 text-center text-lg font-semibold tracking-[0.1em] text-[var(--sea-ink)] uppercase">
            <Link to="/" className="no-underline text-inherit">
              Poster Lim
            </Link>
          </h2>

          <div className="ml-auto flex items-center gap-4 text-xs font-medium uppercase tracking-[0.1em] text-[var(--sea-ink-soft)]">
            {!isAdminSession ? (
              <Link to="/cart" className="no-underline text-inherit flex items-center gap-1.5 hover:text-[var(--sea-ink)] transition-colors">
                <RiShoppingBag2Line size={18} />
                <span>Cart ({hydrated ? cartCount : 0})</span>
              </Link>
            ) : null}

            {hydrated && session ? (
              <button
                type="button"
                onClick={() => {
                  void onLogout()
                }}
                className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.1em] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] transition-colors"
              >
                <RiLogoutBoxRLine size={18} />
                <span>Logout</span>
              </button>
            ) : (
              <Link to="/login" className="no-underline text-inherit">
                Login
              </Link>
            )}

            <ThemeToggle />
          </div>
        </div>

        {isAdminSession ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-xs font-semibold uppercase tracking-[0.1em] sm:justify-center">
            <Link
              to="/admin/posters"
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
            >
              Manage
            </Link>
            <Link
              to="/admin/orders"
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
            >
              Track Orders
            </Link>
            <Link
              to="/admin/settings"
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
            >
              Settings
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-xs font-semibold uppercase tracking-[0.1em] sm:justify-center">
            <Link to="/" className="nav-link" activeProps={{ className: 'nav-link is-active' }}>
              Browse
            </Link>
            <Link
              to="/account/orders"
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
            >
              Orders
            </Link>
          </div>
        )}
      </nav>
      <Ticker />
    </header>
  )
}
