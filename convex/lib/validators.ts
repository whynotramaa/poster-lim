import { v } from "convex/values";

export const userRoleValidator = v.union(
  v.literal("customer"),
  v.literal("admin"),
);

export const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("shipped"),
  v.literal("delivered"),
);

export const posterSortValidator = v.union(
  v.literal("newest"),
  v.literal("popular"),
  v.literal("priceAsc"),
  v.literal("priceDesc"),
);

export const posterSizeValidator = v.union(
  v.literal("S"),
  v.literal("M"),
  v.literal("L"),
  v.literal("XL"),
  v.literal("A4"),
  v.literal("A3"),
  v.literal("A2"),
);

export const sizeInventoryItemValidator = v.object({
  size: posterSizeValidator,
  stock: v.number(),
});

export const shippingAddressValidator = v.object({
  line1: v.string(),
  city: v.string(),
  state: v.string(),
  pincode: v.string(),
  phone: v.string(),
});

export const orderItemInputValidator = v.object({
  posterId: v.id("posters"),
  selectedSize: v.optional(posterSizeValidator),
  quantity: v.number(),
  unitPrice: v.number(),
});
