import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserByAuthUserId } from "./lib/authz";
import { userRoleValidator } from "./lib/validators";

const UNIVERSAL_ADMIN_EMAIL = "abhi.cdh211@gmail.com";

export const syncUser = mutation({
  args: {
    authUserId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const authUserId = args.authUserId.trim();
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    const derivedRole =
      email === UNIVERSAL_ADMIN_EMAIL ? "admin" : "customer";

    if (!authUserId || !email || !name) {
      throw new ConvexError("Invalid user payload");
    }

    const now = Date.now();
    const existing = await getUserByAuthUserId(ctx, authUserId);

    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        name,
        // Preserve explicitly assigned roles in DB; only enforce universal admin email.
        role: email === UNIVERSAL_ADMIN_EMAIL ? "admin" : existing.role,
        updatedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("users", {
      authUserId,
      email,
      name,
      role: derivedRole,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getUserByAuthId = query({
  args: {
    authUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await getUserByAuthUserId(ctx, args.authUserId);
  },
});

export const updateOwnProfile = mutation({
  args: {
    authUserId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByAuthUserId(ctx, args.authUserId);
    if (!user) {
      throw new ConvexError("Not authenticated");
    }

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("Name cannot be empty");
    }

    await ctx.db.patch(user._id, {
      name,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});

export const updateUserRole = mutation({
  args: {
    actorAuthUserId: v.string(),
    targetUserId: v.id("users"),
    role: userRoleValidator,
  },
  handler: async (ctx, args) => {
    const actor = await getUserByAuthUserId(ctx, args.actorAuthUserId);
    if (!actor || actor.role !== "admin") {
      throw new ConvexError("Unauthorized");
    }

    const target = await ctx.db.get(args.targetUserId);
    if (!target) {
      throw new ConvexError("User not found");
    }

    await ctx.db.patch(target._id, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return target._id;
  },
});
