import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { toast } from '#/stores/toastStore'
import { useSessionStore } from '#/stores/sessionStore'
import { formatPrice } from '#/lib/format'

export const Route = createFileRoute('/admin/settings')({
  component: AdminSettingsPage,
})

function AdminSettingsPage() {
  const settings = useQuery(api.settings.getSettings, {})
  const updateCoverImage = useMutation(api.settings.updateCoverImage)
  const updateTickerItems = useMutation(api.settings.updateTickerItems)
  const session = useSessionStore((state) => state.session)
  const upsertCoupon = useMutation(api.coupons.upsertCoupon)
  const deleteCoupon = useMutation(api.coupons.deleteCoupon)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [coverImageUrl, setCoverImageUrl] = useState('/cover.png')
  const [tickerItems, setTickerItems] = useState<string[]>([])
  const [newTickerItem, setNewTickerItem] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponType, setCouponType] = useState<'amount' | 'percentage'>('percentage')
  const [couponValueInput, setCouponValueInput] = useState('')

  const coupons = useQuery(
    api.coupons.getCouponsForAdmin,
    session
      ? {
          actorAuthUserId: session.authUserId,
        }
      : 'skip',
  )

  useEffect(() => {
    if (!settings) {
      return
    }
    setCoverImageUrl(settings.coverImageUrl || '/cover.png')
    setTickerItems(settings.tickerItems || [])
  }, [settings])

  async function saveCoverImage(nextUrl: string) {
    const normalized = nextUrl.trim()
    const actorAuthUserId = session?.authUserId
    if (!actorAuthUserId) {
      toast.error('Not authenticated')
      return
    }
    if (!normalized) {
      toast.error('Cover image URL is required')
      return
    }

    setIsSaving(true)
    try {
      await updateCoverImage({ actorAuthUserId, coverImageUrl: normalized })
      setCoverImageUrl(normalized)
      toast.success('Cover image updated')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update cover image'
      toast.error('Save failed', message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFileUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file', 'Please choose an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) {
        toast.error('Upload failed', 'Could not read the selected file')
        return
      }
      await saveCoverImage(dataUrl)
    }
    reader.onerror = () => {
      toast.error('Upload failed', 'Could not read the selected file')
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleAddTickerItem() {
    const actorAuthUserId = session?.authUserId
    if (!actorAuthUserId) {
      toast.error('Not authenticated')
      return
    }
    const next = newTickerItem.trim()
    if (!next) {
      toast.error('Ticker item is required')
      return
    }

    const updated = [...tickerItems, next]
    setIsSaving(true)
    try {
      await updateTickerItems({ actorAuthUserId, tickerItems: updated })
      setTickerItems(updated)
      setNewTickerItem('')
      toast.success('Ticker item added')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add ticker item'
      toast.error('Save failed', message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveTickerItem(index: number) {
    const actorAuthUserId = session?.authUserId
    if (!actorAuthUserId) {
      toast.error('Not authenticated')
      return
    }
    const updated = tickerItems.filter((_, i) => i !== index)
    if (updated.length === 0) {
      toast.error('At least one ticker item is required')
      return
    }

    setIsSaving(true)
    try {
      await updateTickerItems({ actorAuthUserId, tickerItems: updated })
      setTickerItems(updated)
      toast.success('Ticker item removed')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove ticker item'
      toast.error('Save failed', message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveTickerEdit() {
    if (editingIndex === null) {
      return
    }
    const actorAuthUserId = session?.authUserId
    if (!actorAuthUserId) {
      toast.error('Not authenticated')
      return
    }

    const next = editingText.trim()
    if (!next) {
      toast.error('Ticker item is required')
      return
    }

    const updated = [...tickerItems]
    updated[editingIndex] = next

    setIsSaving(true)
    try {
      await updateTickerItems({ actorAuthUserId, tickerItems: updated })
      setTickerItems(updated)
      setEditingIndex(null)
      setEditingText('')
      toast.success('Ticker item updated')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update ticker item'
      toast.error('Save failed', message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpsertCoupon() {
    const actorAuthUserId = session?.authUserId
    if (!actorAuthUserId) {
      toast.error('Not authenticated')
      return
    }

    const code = couponCode.trim().toUpperCase()
    const parsed = Number(couponValueInput)
    if (!code) {
      toast.error('Coupon code is required')
      return
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Coupon value must be greater than zero')
      return
    }

    const discountValue =
      couponType === 'amount'
        ? Math.round(parsed * 100)
        : Math.round(parsed)

    setIsSaving(true)
    try {
      await upsertCoupon({
        actorAuthUserId,
        code,
        discountType: couponType,
        discountValue,
        isActive: true,
      })
      setCouponCode('')
      setCouponValueInput('')
      toast.success('Coupon saved')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save coupon'
      toast.error('Save failed', message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteCoupon(couponId: string) {
    const actorAuthUserId = session?.authUserId
    if (!actorAuthUserId) {
      toast.error('Not authenticated')
      return
    }

    setIsSaving(true)
    try {
      await deleteCoupon({
        actorAuthUserId,
        couponId: couponId as Id<'coupons'>,
      })
      toast.success('Coupon deleted')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete coupon'
      toast.error('Delete failed', message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell rounded-2xl p-6">
        <p className="island-kicker mb-2">Settings</p>
        <h1 className="m-0 mb-8 text-3xl font-bold">Manage Hero and Ticker</h1>

        <div className="mb-10 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="mb-4 text-xl font-semibold">Cover Image</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Upload image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                disabled={isSaving}
                onChange={(event) => {
                  void handleFileUpload(event.target.files)
                }}
                className="block w-full cursor-pointer rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm dark:bg-[var(--surface)]"
              />
            </div>

            <div className="text-center text-xs text-[var(--sea-ink-soft)]">or set by URL</div>

            <div>
              <label className="mb-2 block text-sm font-medium">Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coverImageUrl}
                  onChange={(event) => setCoverImageUrl(event.target.value)}
                  placeholder="/cover.png or https://..."
                  className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm dark:bg-[var(--surface)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    void saveCoverImage(coverImageUrl)
                  }}
                  disabled={isSaving}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Preview</p>
              <div className="h-44 w-full overflow-hidden rounded-md border border-[var(--line)] bg-black/10">
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="mb-4 text-xl font-semibold">Ticker Items</h2>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newTickerItem}
              onChange={(event) => setNewTickerItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleAddTickerItem()
                }
              }}
              placeholder="Add new ticker text"
              className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm dark:bg-[var(--surface)]"
            />
            <button
              type="button"
              onClick={() => {
                void handleAddTickerItem()
              }}
              disabled={isSaving || !newTickerItem.trim()}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            {tickerItems.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3"
              >
                {editingIndex === index ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleSaveTickerEdit()
                        }
                      }}
                      className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm dark:bg-[var(--surface)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveTickerEdit()
                      }}
                      disabled={isSaving}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIndex(null)
                        setEditingText('')
                      }}
                      className="rounded-md bg-gray-500 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{item}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIndex(index)
                        setEditingText(item)
                      }}
                      disabled={isSaving}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleRemoveTickerItem(index)
                      }}
                      disabled={isSaving || tickerItems.length === 1}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="mb-4 text-xl font-semibold">Coupons</h2>

          <div className="mb-5 grid gap-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr_auto] sm:items-end">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sea-ink-soft)]">
                Coupon code
              </span>
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="SAVE10"
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm uppercase dark:bg-[var(--surface)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sea-ink-soft)]">
                Type
              </span>
              <select
                value={couponType}
                onChange={(event) => setCouponType(event.target.value as 'amount' | 'percentage')}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm dark:bg-[var(--surface)]"
              >
                <option value="percentage">Percentage</option>
                <option value="amount">Fixed amount (INR)</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sea-ink-soft)]">
                Value
              </span>
              <input
                type="number"
                min="0"
                step={couponType === 'amount' ? '0.01' : '1'}
                value={couponValueInput}
                onChange={(event) => setCouponValueInput(event.target.value)}
                placeholder={couponType === 'amount' ? '100.00' : '10'}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm dark:bg-[var(--surface)]"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                void handleUpsertCoupon()
              }}
              disabled={isSaving}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Save Coupon
            </button>
          </div>

          <div className="space-y-2">
            {coupons === undefined ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">Loading coupons...</p>
            ) : coupons.length === 0 ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">No coupons yet.</p>
            ) : (
              coupons.map((coupon) => (
                <div
                  key={coupon._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--line)] p-3"
                >
                  <div>
                    <p className="m-0 text-sm font-semibold">{coupon.code}</p>
                    <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                      {coupon.discountType === 'percentage'
                        ? `${coupon.discountValue}% off`
                        : `${formatPrice(coupon.discountValue)} off`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteCoupon(coupon._id)
                    }}
                    disabled={isSaving}
                    className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
