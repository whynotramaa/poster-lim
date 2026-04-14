export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-[var(--sea-ink-soft)]">
      <div className="page-wrap flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="m-0 text-xs tracking-[0.08em] uppercase">
          &copy; {year} Poster Lim. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
