import { useEffect } from 'react'
import { useToastStore } from '#/stores/toastStore'

const TOAST_TIMEOUT_MS = 3800

export default function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)

  useEffect(() => {
    if (toasts.length === 0) {
      return
    }

    const timerIds = toasts.map((toast) =>
      window.setTimeout(() => removeToast(toast.id), TOAST_TIMEOUT_MS),
    )

    return () => {
      for (const timerId of timerIds) {
        window.clearTimeout(timerId)
      }
    }
  }, [toasts, removeToast])

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="toast-viewport" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast-card toast-${toast.tone}`}>
          <div>
            <p className="toast-title">{toast.title}</p>
            {toast.description ? <p className="toast-description">{toast.description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="toast-dismiss"
            aria-label="Dismiss notification"
          >
            x
          </button>
        </article>
      ))}
    </div>
  )
}
