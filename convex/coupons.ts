import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminByAuthUserId } from "./lib/authz";

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function calculateDiscount(
  subtotalAmount: number,
  discountType: "amount" | "percentage",
  discountValue: number,
) {
  if (discountType === "amount") {
    return Math.min(subtotalAmount, Math.max(0, Math.floor(discountValue)));
  }

  const percentage = Math.max(0, Math.min(100, discountValue));
  return Math.min(
    subtotalAmount,
    Math.round((subtotalAmount * percentage) / 100),
  );
}

export const getCouponsForAdmin = query({
  args: {
    actorAuthUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const coupons = await ctx.db.query("coupons").collect();
    return coupons.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const upsertCoupon = mutation({
  args: {
    actorAuthUserId: v.string(),
    code: v.string(),
    discountType: v.union(v.literal("amount"), v.literal("percentage")),
    discountValue: v.number(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const code = normalizeCode(args.code);
    if (!code) {
      throw new ConvexError("Coupon code is required");
    }

    if (!Number.isFinite(args.discountValue) || args.discountValue <= 0) {
      throw new ConvexError("Discount value must be greater than zero");
    }

    if (args.discountType === "percentage" && args.discountValue > 100) {
      throw new ConvexError("Percentage discount cannot exceed 100");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        discountType: args.discountType,
        discountValue: Math.floor(args.discountValue),
        isActive: args.isActive ?? true,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("coupons", {
      code,
      discountType: args.discountType,
      discountValue: Math.floor(args.discountValue),
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteCoupon = mutation({
  args: {
    actorAuthUserId: v.string(),
    couponId: v.id("coupons"),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);
    await ctx.db.delete(args.couponId);
  },
});

export const previewCoupon = query({
  args: {
    code: v.string(),
    subtotalAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const code = normalizeCode(args.code);
    if (!code) {
      return null;
    }

    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (!coupon || !coupon.isActive) {
      return null;
    }

    const subtotal = Math.max(0, Math.floor(args.subtotalAmount));
    const discountAmount = calculateDiscount(
      subtotal,
      coupon.discountType,
      coupon.discountValue,
    );

    return {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      subtotalAmount: subtotal,
      discountAmount,
      totalAmount: subtotal - discountAmount,
    };
  },
});
