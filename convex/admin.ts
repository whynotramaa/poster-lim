import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireAdminByAuthUserId } from "./lib/authz";

export const getAdminStats = query({
  args: {
    actorAuthUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    let totalRevenue = 0;
    const statusCounts: Record<string, number> = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
    };
    const qtyByPosterId = new Map<Id<"posters">, number>();

    for (const order of recentOrders) {
      totalRevenue += order.totalAmount;
      statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;

      for (const item of order.items) {
        const key = item.posterId;
        qtyByPosterId.set(key, (qtyByPosterId.get(key) ?? 0) + item.quantity);
      }
    }

    const topPosterIds = [...qtyByPosterId.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([posterId]) => posterId);

    const topSellingPosters = [] as {
      posterId: Id<"posters">;
      title: string;
      imageUrl: string;
      quantitySold: number;
    }[];

    for (const posterId of topPosterIds) {
      const poster = await ctx.db.get(posterId);
      if (!poster) {
        continue;
      }

      const quantitySold = qtyByPosterId.get(posterId);
      if (quantitySold === undefined) {
        throw new ConvexError("Poster aggregate mismatch");
      }

      topSellingPosters.push({
        posterId,
        title: poster.title,
        imageUrl: poster.imageUrl,
        quantitySold,
      });
    }

    return {
      totalRevenue,
      orderCount: recentOrders.length,
      statusCounts,
      topSellingPosters,
      recentActivity: recentOrders.slice(0, 10).map((order) => ({
        orderId: order._id,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
      })),
      sampledOrdersWindow: recentOrders.length,
    };
  },
});
