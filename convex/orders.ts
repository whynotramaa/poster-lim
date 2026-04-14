import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireAdminByAuthUserId, requireUserByAuthUserId } from "./lib/authz";
import { orderItemInputValidator, orderStatusValidator, shippingAddressValidator } from "./lib/validators";

const PRICE_TOLERANCE = 1;
const RATE_LIMIT_WINDOW_MS = 30_000;
const RATE_LIMIT_MAX_ATTEMPTS = 3;

const validTransitions: Record<string, string[]> = {
  pending: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
};

async function checkRateLimit(
  ctx: MutationCtx,
  authUserId: string,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("orderRateLimits")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId.trim()))
    .unique();

  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    if (existing) {
      await ctx.db.patch(existing._id, {
        windowStart: now,
        attemptCount: 1,
      });
      return;
    }

    await ctx.db.insert("orderRateLimits", {
      authUserId: authUserId.trim(),
      windowStart: now,
      attemptCount: 1,
    });
    return;
  }

  if (existing.attemptCount >= RATE_LIMIT_MAX_ATTEMPTS) {
    throw new ConvexError("Too many order attempts. Please try again shortly.");
  }

  await ctx.db.patch(existing._id, {
    attemptCount: existing.attemptCount + 1,
  });
}

export const getUserOrders = query({
  args: {
    authUserId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserByAuthUserId(ctx, args.authUserId);

    return await ctx.db
      .query("orders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getAllOrders = query({
  args: {
    actorAuthUserId: v.string(),
    paginationOpts: paginationOptsValidator,
    status: v.optional(orderStatusValidator),
    startCreatedAt: v.optional(v.number()),
    endCreatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const startCreatedAt = args.startCreatedAt;
    const endCreatedAt = args.endCreatedAt;
    if (
      startCreatedAt !== undefined &&
      endCreatedAt !== undefined &&
      startCreatedAt > endCreatedAt
    ) {
      throw new ConvexError("startCreatedAt must be <= endCreatedAt");
    }

    if (args.status) {
      const status = args.status;
      const result = await ctx.db
        .query("orders")
        .withIndex("by_status_and_createdAt", (q) =>
          startCreatedAt !== undefined && endCreatedAt !== undefined
            ? q
                .eq("status", status)
                .gte("createdAt", startCreatedAt)
                .lte("createdAt", endCreatedAt)
            : startCreatedAt !== undefined
              ? q.eq("status", status).gte("createdAt", startCreatedAt)
              : endCreatedAt !== undefined
                ? q.eq("status", status).lte("createdAt", endCreatedAt)
                : q.eq("status", status),
        )
        .order("desc")
        .paginate(args.paginationOpts);

      return result;
    }

    const result = await ctx.db
      .query("orders")
      .withIndex("by_createdAt", (q) =>
        startCreatedAt !== undefined && endCreatedAt !== undefined
          ? q.gte("createdAt", startCreatedAt).lte("createdAt", endCreatedAt)
          : startCreatedAt !== undefined
            ? q.gte("createdAt", startCreatedAt)
            : endCreatedAt !== undefined
              ? q.lte("createdAt", endCreatedAt)
              : q,
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return result;
  },
});

export const createOrder = mutation({
  args: {
    authUserId: v.string(),
    items: v.array(orderItemInputValidator),
    shippingAddress: shippingAddressValidator,
    couponCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserByAuthUserId(ctx, args.authUserId);
    await checkRateLimit(ctx, args.authUserId);

    if (args.items.length < 1) {
      throw new ConvexError("Order must contain at least one item");
    }
    if (args.items.length > 50) {
      throw new ConvexError("Order cannot contain more than 50 items");
    }

    let subtotalAmount = 0;
    const normalizedItems: {
      posterId: (typeof args.items)[number]["posterId"];
      selectedSize?: (typeof args.items)[number]["selectedSize"];
      quantity: number;
      unitPrice: number;
    }[] = [];
    const reservedStockByPoster = new Map<Id<"posters">, Map<string, number>>();

    for (const item of args.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ConvexError("Quantity must be a positive integer");
      }

      const poster = await ctx.db.get(item.posterId);
      if (!poster || !poster.isActive) {
        throw new ConvexError("One or more posters are unavailable");
      }

      const hasInventory =
        Array.isArray(poster.sizeInventory) && poster.sizeInventory.length > 0;
      if (hasInventory) {
        const selectedSize = item.selectedSize;
        if (!selectedSize) {
          throw new ConvexError("Please select a size before checkout.");
        }

        const inventoryEntry = poster.sizeInventory?.find(
          (entry) => entry.size === selectedSize,
        );
        if (!inventoryEntry) {
          throw new ConvexError("Selected size is unavailable.");
        }

        const posterReservations =
          reservedStockByPoster.get(poster._id) ?? new Map<string, number>();
        const alreadyReserved = posterReservations.get(selectedSize) ?? 0;
        if (inventoryEntry.stock - alreadyReserved < item.quantity) {
          throw new ConvexError("Selected size is out of stock.");
        }

        posterReservations.set(selectedSize, alreadyReserved + item.quantity);
        reservedStockByPoster.set(poster._id, posterReservations);
      }

      if (Math.abs(poster.price - item.unitPrice) > PRICE_TOLERANCE) {
        throw new ConvexError(
          "Poster prices changed. Please refresh your cart and try again.",
        );
      }

      subtotalAmount += poster.price * item.quantity;
      normalizedItems.push({
        posterId: poster._id,
        selectedSize: item.selectedSize,
        quantity: item.quantity,
        unitPrice: poster.price,
      });
    }

    const normalizedCouponCode = args.couponCode?.trim().toUpperCase();
    let discountAmount = 0;

    if (normalizedCouponCode) {
      const coupon = await ctx.db
        .query("coupons")
        .withIndex("by_code", (q) => q.eq("code", normalizedCouponCode))
        .unique();

      if (!coupon || !coupon.isActive) {
        throw new ConvexError("Invalid or inactive coupon code");
      }

      discountAmount =
        coupon.discountType === "amount"
          ? Math.min(subtotalAmount, Math.max(0, Math.floor(coupon.discountValue)))
          : Math.min(
              subtotalAmount,
              Math.round(
                (subtotalAmount * Math.max(0, Math.min(100, coupon.discountValue))) /
                  100,
              ),
            );
    }

    const totalAmount = subtotalAmount - discountAmount;
    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      userId: user._id,
      items: normalizedItems,
      totalAmount,
      subtotalAmount,
      discountAmount,
      couponCode: normalizedCouponCode,
      status: "pending",
      shippingAddress: args.shippingAddress,
      createdAt: now,
      updatedAt: now,
    });

    const popularityByPoster = new Map<Id<"posters">, number>();
    for (const item of normalizedItems) {
      const current = popularityByPoster.get(item.posterId) ?? 0;
      popularityByPoster.set(item.posterId, current + item.quantity);
    }

    for (const [posterId, quantity] of popularityByPoster.entries()) {
      const poster = await ctx.db.get(posterId);
      if (!poster) {
        continue;
      }

      const reservations = reservedStockByPoster.get(posterId);
      if (reservations && poster.sizeInventory) {
        const nextInventory = poster.sizeInventory.map((entry) => {
          const reserved = reservations.get(entry.size) ?? 0;
          return {
            ...entry,
            stock: Math.max(0, entry.stock - reserved),
          };
        });

        await ctx.db.patch(posterId, {
          popularityScore: poster.popularityScore + quantity,
          sizeInventory: nextInventory,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(posterId, {
          popularityScore: poster.popularityScore + quantity,
          updatedAt: now,
        });
      }
    }

    return {
      orderId,
      subtotalAmount,
      discountAmount,
      totalAmount,
      status: "pending" as const,
    };
  },
});

export const updateOrderStatus = mutation({
  args: {
    actorAuthUserId: v.string(),
    orderId: v.id("orders"),
    status: orderStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError("Order not found");
    }

    if (order.status === args.status) {
      return order._id;
    }

    const allowed = validTransitions[order.status] ?? [];
    if (!allowed.includes(args.status)) {
      throw new ConvexError("Invalid order status transition");
    }

    await ctx.db.patch(order._id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return order._id;
  },
});
