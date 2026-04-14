import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const roleValidator = v.union(v.literal("customer"), v.literal("admin"));
const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("shipped"),
  v.literal("delivered"),
);
const posterSizeValidator = v.union(
  v.literal("S"),
  v.literal("M"),
  v.literal("L"),
  v.literal("XL"),
  v.literal("A4"),
  v.literal("A3"),
  v.literal("A2"),
);

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: roleValidator,
    authUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),

  posters: defineTable({
    title: v.string(),
    description: v.string(),
    searchText: v.string(),
    price: v.number(),
    imageUrl: v.string(),
    images: v.optional(v.array(v.string())),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    sizeInventory: v.optional(
      v.array(
        v.object({
          size: posterSizeValidator,
          stock: v.number(),
        }),
      ),
    ),
    category: v.string(),
    isActive: v.boolean(),
    popularityScore: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_category_and_isActive", ["category", "isActive"])
    .index("by_isActive_and_price", ["isActive", "price"])
    .index("by_category_and_isActive_and_price", ["category", "isActive", "price"])
    .index("by_isActive_and_popularityScore", ["isActive", "popularityScore"])
    .searchIndex("search_searchText", {
      searchField: "searchText",
      filterFields: ["isActive", "category"],
    }),

  orders: defineTable({
    userId: v.id("users"),
    items: v.array(
      v.object({
        posterId: v.id("posters"),
        selectedSize: v.optional(posterSizeValidator),
        quantity: v.number(),
        unitPrice: v.number(),
      }),
    ),
    totalAmount: v.number(),
    subtotalAmount: v.optional(v.number()),
    discountAmount: v.optional(v.number()),
    couponCode: v.optional(v.string()),
    status: orderStatusValidator,
    shippingAddress: v.object({
      line1: v.string(),
      city: v.string(),
      state: v.string(),
      pincode: v.string(),
      phone: v.string(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  orderRateLimits: defineTable({
    authUserId: v.string(),
    windowStart: v.number(),
    attemptCount: v.number(),
  }).index("by_authUserId", ["authUserId"]),

  settings: defineTable({
    coverImageUrl: v.optional(v.string()),
    tickerItems: v.array(v.string()),
    updatedAt: v.number(),
  }),

  coupons: defineTable({
    code: v.string(),
    discountType: v.union(v.literal("amount"), v.literal("percentage")),
    discountValue: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),
});
