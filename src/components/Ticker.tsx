import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export default function Ticker() {
  const settings = useQuery(api.settings.getSettings, {})
  const tickerItems = settings?.tickerItems ?? []
  const loop = [...tickerItems, ...tickerItems]

  return (
    <div className="ticker-shell" aria-label="Promotions">
      <div className="ticker-track">
        {loop.map((item, index) => (
          <span key={`${item}-${index}`} className="ticker-item">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
