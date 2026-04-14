import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminByAuthUserId } from "./lib/authz";

export const generateUploadUrl = mutation({
  args: {
    actorAuthUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);
    return await ctx.storage.generateUploadUrl();
  },
});
