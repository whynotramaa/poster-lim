# Poster Marketplace — Technical Specification

**Version:** 1.0
**Status:** Draft
**Audience:** Engineering, Product

---

## 1. Overview

A poster e-commerce platform with a public browsing experience, cart-first UX (no forced login until checkout), real-time inventory/order updates via Convex, and a first-class admin panel for poster and order management.

### Core Principles

- **Friction-free discovery** — browsing and carting require no account
- **Login at the last responsible moment** — only triggered at checkout
- **Real-time by default** — Convex subscriptions keep UI in sync without polling
- **Clear separation of concerns** — auth (Better Auth), data (Convex), routing/UI (TanStack)

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | TanStack Start | Full-stack React with SSR support |
| Routing | TanStack Router | Type-safe, file-based routing |
| Data fetching | TanStack Query | Caching, deduplication, background refetch |
| Backend / DB | Convex | Reactive NoSQL, real-time subscriptions, serverless functions |
| Auth | Better Auth | Session management, OAuth + email, framework-agnostic |
| Styling | Tailwind CSS + ShadCN UI | Utility-first with accessible component primitives |
| Hosting | Vercel (frontend) + Convex Cloud (backend) | |

> **Note:** Better Auth and Convex do not share a native integration. User sync between the two must be handled explicitly — see Section 7.

---

## 3. Feature Scope

### 3.1 Customer-Facing

#### Browsing (Unauthenticated)

- Poster grid on homepage with pagination or infinite scroll
- Filter by category, price range, and popularity
- Full-text search
- Poster detail page: image, title, description, price, size variants

#### Cart

- Add, remove, update quantity
- Persisted in `localStorage` (no account required)
- Synced to backend only at checkout time
- Display running total

#### Checkout (Authentication Required)

- Intercept unauthenticated users and redirect to login; resume checkout after
- Collect shipping address and contact info
- Submit order — creates record in Convex, clears local cart

#### User Dashboard

- Order history with current status per order
- Basic profile management

---

### 3.2 Admin

Access to admin routes is restricted by role — see Section 9 (Security).

#### Dashboard

- KPIs: total revenue, order count, top-selling posters, recent activity feed

#### Poster Management

- Create, update, delete posters
- Image upload (CDN-backed)

#### Order Management

- View all orders, filterable by status and date
- Update order status: `pending → processing → shipped → delivered`

---

## 4. Data Model (Convex)

### Users

```ts
users: defineTable({
  email: v.string(),
  name: v.string(),
  role: v.union(v.literal("customer"), v.literal("admin")),
  authUserId: v.string(),   // Better Auth user ID — used for lookup on login sync
  createdAt: v.number(),
})
.index("by_authUserId", ["authUserId"])
.index("by_email", ["email"])
```

### Posters

```ts
posters: defineTable({
  title: v.string(),
  description: v.string(),
  price: v.number(),           // stored in minor units (paise / cents) to avoid float issues
  imageUrl: v.string(),
  category: v.string(),
  isActive: v.boolean(),       // soft delete / draft support
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_category", ["category"])
.index("by_active", ["isActive"])
```

### Orders

```ts
orders: defineTable({
  userId: v.id("users"),
  items: v.array(v.object({
    posterId: v.id("posters"),
    quantity: v.number(),
    unitPrice: v.number(),     // snapshot price at time of order
  })),
  totalAmount: v.number(),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("shipped"),
    v.literal("delivered"),
  ),
  shippingAddress: v.object({
    line1: v.string(),
    city: v.string(),
    state: v.string(),
    pincode: v.string(),
    phone: v.string(),
  }),
  createdAt: v.number(),
})
.index("by_userId", ["userId"])
.index("by_status", ["status"])
```

> **Design note:** `unitPrice` is snapshotted on order creation. Never read price from the poster at display time for historical orders — prices change.

---

## 5. API Design (Convex Functions)

### Queries

```ts
getPosters({ category?, priceRange?, search? })   // public
getPosterById(id)                                  // public
getUserOrders(userId)                              // authenticated
getAllOrders({ status?, page? })                   // admin only
getAdminStats()                                    // admin only
```

### Mutations

```ts
createOrder(userId, items, shippingAddress)        // authenticated
updateOrderStatus(orderId, status)                 // admin only
createPoster(data)                                 // admin only
updatePoster(id, data)                             // admin only
deletePoster(id)                                   // admin only (soft delete)
syncUser(authUserId, email, name)                  // called on login
```

All mutations that modify data must validate caller permissions server-side. Never trust role data passed from the client.

---

## 6. Real-Time Behaviour

Convex queries are reactive by default — subscribed components re-render when underlying data changes.

| Subscription | Benefit |
|---|---|
| `getPosters` | Admin poster changes (price, availability) propagate to all browsing users instantly |
| `getUserOrders` | Customer sees status updates without polling |
| `getAllOrders` | Admin order list stays live without page refresh |

No additional WebSocket management is needed — Convex handles this.

---

## 7. Authentication & User Sync

Better Auth manages sessions. Convex manages application data. They are independent systems and must be explicitly bridged.

### Flow

```
User initiates checkout
  → Check Better Auth session
  → Not authenticated → redirect to /login?redirect=/checkout
  → Authenticated → call syncUser() mutation
      → Upsert user in Convex by authUserId
  → Resume checkout with Convex userId
```

### Sync Strategy

- On every login, call `syncUser(authUserId, email, name)` — use `patch` semantics (upsert)
- Index `users` by `authUserId` for efficient lookup
- Never store the Better Auth session token in Convex; let Better Auth own the session

### Session Check Pattern (TanStack Router)

Use a `beforeLoad` guard on protected routes:

```ts
// routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    const session = await context.auth.getSession()
    if (!session) throw redirect({ to: '/login' })
  }
})
```

---

## 8. Cart Strategy

Cart lives in `localStorage` and is never persisted server-side until checkout.

```ts
type CartItem = {
  posterId: string
  title: string
  imageUrl: string
  price: number        // minor units
  quantity: number
}
```

- Use a Zustand store backed by a `localStorage` middleware for persistence across page reloads
- On checkout, validate poster prices server-side before accepting the order — do not trust client-submitted prices
- Clear cart only after a successful `createOrder` mutation response

---

## 9. Security

- **Admin route protection:** Enforce role check in both TanStack Router `beforeLoad` guards and inside every Convex mutation/query marked admin-only. Client-side guards are UX; server-side guards are security.
- **Price validation:** On `createOrder`, re-fetch poster prices from the DB and compare against submitted values. Reject if mismatch exceeds a small tolerance.
- **Input validation:** Use `v` validators in every Convex function — reject unexpected fields.
- **Rate limiting:** Limit `createOrder` calls per user to prevent abuse (Convex supports this via custom middleware or a simple rate-limit table).
- **Image uploads:** Validate file type and size server-side. Use Convex file storage or a CDN with signed upload URLs — never expose a direct write endpoint.

---

## 10. Page Structure

### Public

| Route | Page |
|---|---|
| `/` | Poster grid (browsable without login) |
| `/poster/:id` | Poster detail |
| `/cart` | Cart |
| `/checkout` | Checkout (requires auth) |

### Auth

| Route | Page |
|---|---|
| `/login` | Login (supports redirect param) |
| `/signup` | Registration |

### Customer

| Route | Page |
|---|---|
| `/account/orders` | Order history |
| `/account/profile` | Profile management |

### Admin

| Route | Page |
|---|---|
| `/admin` | Dashboard / KPIs |
| `/admin/posters` | Poster CRUD |
| `/admin/orders` | Order management |

---

## 11. Frontend Architecture

```
/app
  /routes
    index.tsx
    poster.$id.tsx
    cart.tsx
    checkout.tsx
    login.tsx
    _authenticated/
      account.orders.tsx
    _admin/
      admin.index.tsx
      admin.posters.tsx
      admin.orders.tsx
  /components
    /ui              # ShadCN primitives
    /posters         # PosterCard, PosterGrid, PosterFilter
    /cart            # CartDrawer, CartItem
    /orders          # OrderStatusBadge, OrderTable
  /stores
    cartStore.ts     # Zustand + localStorage
  /lib
    convex.ts        # Convex client setup
    auth.ts          # Better Auth client setup
  /hooks
    usePosters.ts
    useOrders.ts
```

---

## 12. Performance

- **Pagination / infinite scroll** on poster grid — do not load all posters client-side
- **TanStack Query caching** for poster detail pages — stale-while-revalidate
- **Image CDN** with responsive sizing — serve appropriately sized images per viewport
- **Lazy load** below-the-fold poster images
- **Optimistic updates** on cart operations for instant UI feedback

---

## 13. Known Engineering Challenges

**Better Auth ↔ Convex user sync** is the highest-risk integration point. Ensure `syncUser` is idempotent and handles race conditions (e.g., rapid logins). Use the `authUserId` index, not email, as the lookup key since emails can change.

**Cart durability before login** — if a user builds a cart, logs in on another device, then returns, the localStorage cart will be empty. Consider surfacing a "your cart was cleared" message rather than silently losing items.

**Price consistency** — Convex is real-time, meaning poster prices shown in the cart can diverge from current prices by the time checkout is submitted. Always re-validate prices server-side and surface any discrepancies to the user before confirming.

---

## 14. Out of Scope (MVP)

The following are intentionally deferred:

- Payment processing (Razorpay / Stripe)
- Wishlists
- Reviews and ratings
- Discount / promo codes
- AI recommendations
- Bulk poster upload
- Email notifications

---

## 15. MVP Definition of Done

| Feature | Required |
|---|---|
| Poster browsing with filter/search | ✅ |
| Persistent cart (localStorage) | ✅ |
| Login gate at checkout | ✅ |
| Order creation | ✅ |
| User order history | ✅ |
| Admin: poster CRUD | ✅ |
| Admin: order status management | ✅ |
| Real-time order status updates | ✅ |
| Analytics dashboard | ⬜ Nice-to-have |
