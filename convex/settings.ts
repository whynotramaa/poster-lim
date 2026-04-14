import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAdminByAuthUserId } from "./lib/authz";

const defaultTickerItems = [
  "FREE SHIPPING OVER INR 2500",
  "LIMITED EDITION DROPS WEEKLY",
  "ONLINE EXCLUSIVE PRINTS",
  "COD AVAILABLE IN SELECT CITIES",
];

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("settings").first();

    if (existing) {
      return existing;
    }

    // Return defaults if doesn't exist
    return {
      coverImageUrl: "/cover.png",
      tickerItems: defaultTickerItems,
      updatedAt: Date.now(),
    };
  },
});

export const updateCoverImage = mutation({
  args: {
    actorAuthUserId: v.string(),
    coverImageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    let settings = await ctx.db.query("settings").first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        coverImageUrl: args.coverImageUrl,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        coverImageUrl: args.coverImageUrl,
        tickerItems: defaultTickerItems,
        updatedAt: Date.now(),
      });
    }
  },
});

export const updateTickerItems = mutation({
  args: {
    actorAuthUserId: v.string(),
    tickerItems: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const filteredItems = args.tickerItems
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (filteredItems.length === 0) {
      throw new ConvexError("At least one ticker item is required");
    }

    let settings = await ctx.db.query("settings").first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        tickerItems: filteredItems,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        coverImageUrl: "/cover.png",
        tickerItems: filteredItems,
        updatedAt: Date.now(),
      });
    }
  },
});
