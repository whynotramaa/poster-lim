import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DbCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export async function getUserByAuthUserId(
  ctx: DbCtx,
  authUserId: string,
): Promise<Doc<"users"> | null> {
  const trimmed = authUserId.trim();
  if (!trimmed) {
    return null;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", trimmed))
    .unique();
}

export async function requireUserByAuthUserId(
  ctx: DbCtx,
  authUserId: string,
): Promise<Doc<"users">> {
  const user = await getUserByAuthUserId(ctx, authUserId);

  if (!user) {
    throw new ConvexError("Not authenticated");
  }

  return user;
}

export async function requireAdminByAuthUserId(
  ctx: DbCtx,
  authUserId: string,
): Promise<Doc<"users">> {
  const user = await getUserByAuthUserId(ctx, authUserId);
  if (user && user.role === "admin") {
    return user;
  }

  throw new ConvexError("Unauthorized");
}
