import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdminByAuthUserId } from "./lib/authz";
import {
  posterSortValidator,
  sizeInventoryItemValidator,
} from "./lib/validators";

function makeSearchText(title: string, description: string) {
  return `${title} ${description}`;
}

function validatePriceRange(minPrice?: number, maxPrice?: number) {
  if (minPrice !== undefined && minPrice < 0) {
    throw new ConvexError("minPrice must be non-negative");
  }

  if (maxPrice !== undefined && maxPrice < 0) {
    throw new ConvexError("maxPrice must be non-negative");
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new ConvexError("minPrice must be <= maxPrice");
  }
}

function inPriceRange(price: number, minPrice?: number, maxPrice?: number) {
  if (minPrice !== undefined && price < minPrice) {
    return false;
  }
  if (maxPrice !== undefined && price > maxPrice) {
    return false;
  }
  return true;
}

function normalizeImages(primaryImageUrl: string, images?: string[]) {
  const input = images ?? [primaryImageUrl];

  const normalized = [
    ...new Set(input.map((entry) => entry.trim()).filter(Boolean)),
  ];
  if (normalized.length === 0) {
    throw new ConvexError("At least one valid image URL is required");
  }

  // Keep the selected primary image as the first media item.
  const primary = primaryImageUrl.trim() || normalized[0];
  const withoutPrimary = normalized.filter((entry) => entry !== primary);
  return [primary, ...withoutPrimary];
}

function normalizeImageList(images: string[]) {
  return [...new Set(images.map((entry) => entry.trim()).filter(Boolean))];
}

function normalizeStorageIds(storageIds?: Id<"_storage">[]) {
  if (!storageIds) {
    return undefined;
  }

  return [...new Set(storageIds)];
}

function normalizeSizeInventory(
  sizeInventory?: {
    size: "S" | "M" | "L" | "XL" | "A4" | "A3" | "A2";
    stock: number;
  }[],
) {
  if (!sizeInventory) {
    return undefined;
  }

  const bySize = new Map<string, number>();
  for (const entry of sizeInventory) {
    const stock = Math.floor(entry.stock);
    if (stock < 0) {
      throw new ConvexError("Stock cannot be negative");
    }
    bySize.set(entry.size, stock);
  }

  return [...bySize.entries()].map(([size, stock]) => ({
    size: size as "S" | "M" | "L" | "XL" | "A4" | "A3" | "A2",
    stock,
  }));
}

async function hydratePosterMedia<
  T extends {
    imageUrl: string;
    images?: string[];
    imageStorageIds?: Id<"_storage">[];
  },
>(
  ctx: {
    storage: { getUrl: (storageId: Id<"_storage">) => Promise<string | null> };
  },
  poster: T,
) {
  const storageUrls = (
    await Promise.all(
      (poster.imageStorageIds ?? []).map((storageId) =>
        ctx.storage.getUrl(storageId),
      ),
    )
  ).filter((url): url is string => Boolean(url));

  const images = normalizeImageList([
    ...storageUrls,
    ...(poster.images ?? []),
    poster.imageUrl,
  ]);

  return {
    ...poster,
    imageUrl: images[0] ?? "",
    images,
  };
}

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const posters = await ctx.db.query("posters").collect();
    const categoriesSet = new Set<string>();

    for (const poster of posters) {
      if (poster.category && poster.category.trim()) {
        categoriesSet.add(poster.category.trim());
      }
    }

    return Array.from(categoriesSet).sort();
  },
});

export const getPosters = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    search: v.optional(v.string()),
    sort: v.optional(posterSortValidator),
  },
  handler: async (ctx, args) => {
    const category = args.category?.trim();
    const search = args.search?.trim();
    const sort = args.sort ?? "newest";

    validatePriceRange(args.minPrice, args.maxPrice);

    if (search) {
      const result = category
        ? await ctx.db
            .query("posters")
            .withSearchIndex("search_searchText", (q) =>
              q
                .search("searchText", search)
                .eq("isActive", true)
                .eq("category", category),
            )
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("posters")
            .withSearchIndex("search_searchText", (q) =>
              q.search("searchText", search).eq("isActive", true),
            )
            .paginate(args.paginationOpts);

      return {
        ...result,
        page: await Promise.all(
          result.page
            .filter((poster) =>
              inPriceRange(poster.price, args.minPrice, args.maxPrice),
            )
            .map((poster) => hydratePosterMedia(ctx, poster)),
        ),
      };
    }

    if (sort === "popular") {
      const result = await ctx.db
        .query("posters")
        .withIndex("by_isActive_and_popularityScore", (q) =>
          q.eq("isActive", true),
        )
        .order("desc")
        .paginate(args.paginationOpts);

      const categoryFiltered = category
        ? result.page.filter((poster) => poster.category === category)
        : result.page;

      return {
        ...result,
        page: await Promise.all(
          categoryFiltered
            .filter((poster) =>
              inPriceRange(poster.price, args.minPrice, args.maxPrice),
            )
            .map((poster) => hydratePosterMedia(ctx, poster)),
        ),
      };
    }

    if (sort === "priceAsc" || sort === "priceDesc") {
      const result = category
        ? await ctx.db
            .query("posters")
            .withIndex("by_category_and_isActive_and_price", (q) =>
              q.eq("category", category).eq("isActive", true),
            )
            .order(sort === "priceAsc" ? "asc" : "desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("posters")
            .withIndex("by_isActive_and_price", (q) => q.eq("isActive", true))
            .order(sort === "priceAsc" ? "asc" : "desc")
            .paginate(args.paginationOpts);

      return {
        ...result,
        page: await Promise.all(
          result.page
            .filter((poster) =>
              inPriceRange(poster.price, args.minPrice, args.maxPrice),
            )
            .map((poster) => hydratePosterMedia(ctx, poster)),
        ),
      };
    }

    const result = category
      ? await ctx.db
          .query("posters")
          .withIndex("by_category_and_isActive", (q) =>
            q.eq("category", category).eq("isActive", true),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("posters")
          .withIndex("by_isActive", (q) => q.eq("isActive", true))
          .order("desc")
          .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page
          .filter((poster) =>
            inPriceRange(poster.price, args.minPrice, args.maxPrice),
          )
          .map((poster) => hydratePosterMedia(ctx, poster)),
      ),
    };
  },
});

export const getPosterById = query({
  args: { posterId: v.id("posters") },
  handler: async (ctx, args) => {
    const poster = await ctx.db.get(args.posterId);
    if (!poster || !poster.isActive) {
      return null;
    }
    return await hydratePosterMedia(ctx, poster);
  },
});

export const getAdminPosters = query({
  args: {
    actorAuthUserId: v.string(),
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const category = args.category?.trim();
    const search = args.search?.trim();
    const isActive = args.isActive ?? true;

    if (search) {
      const result = category
        ? await ctx.db
            .query("posters")
            .withSearchIndex("search_searchText", (q) =>
              q
                .search("searchText", search)
                .eq("isActive", isActive)
                .eq("category", category),
            )
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("posters")
            .withSearchIndex("search_searchText", (q) =>
              q.search("searchText", search).eq("isActive", isActive),
            )
            .paginate(args.paginationOpts);

      return {
        ...result,
        page: await Promise.all(
          result.page.map((poster) => hydratePosterMedia(ctx, poster)),
        ),
      };
    }

    const result = category
      ? await ctx.db
          .query("posters")
          .withIndex("by_category_and_isActive", (q) =>
            q.eq("category", category).eq("isActive", isActive),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("posters")
          .withIndex("by_isActive", (q) => q.eq("isActive", isActive))
          .order("desc")
          .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page.map((poster) => hydratePosterMedia(ctx, poster)),
      ),
    };
  },
});

export const getAdminPosterById = query({
  args: {
    actorAuthUserId: v.string(),
    posterId: v.id("posters"),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const poster = await ctx.db.get(args.posterId);
    if (!poster) {
      return null;
    }

    return await hydratePosterMedia(ctx, poster);
  },
});

export const createPoster = mutation({
  args: {
    actorAuthUserId: v.string(),
    title: v.string(),
    description: v.string(),
    price: v.number(),
    imageUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    sizeInventory: v.optional(v.array(sizeInventoryItemValidator)),
    category: v.string(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const title = args.title.trim();
    const description = args.description.trim();
    const category = args.category.trim();
    const imageUrl = args.imageUrl?.trim() ?? "";
    const imageStorageIds = normalizeStorageIds(args.imageStorageIds);
    const images = normalizeImageList(args.images ?? []);
    const sizeInventory = normalizeSizeInventory(args.sizeInventory);

    if (!title || !description || !category) {
      throw new ConvexError("Poster fields cannot be empty");
    }

    if (
      !imageUrl &&
      images.length === 0 &&
      (!imageStorageIds || imageStorageIds.length === 0)
    ) {
      throw new ConvexError("Add at least one image URL or upload an image");
    }

    const fallbackImages = normalizeImageList([imageUrl, ...images]);
    const primaryImageUrl = fallbackImages[0] ?? "";

    if (args.price < 0) {
      throw new ConvexError("Price must be non-negative");
    }

    const now = Date.now();
    return await ctx.db.insert("posters", {
      title,
      description,
      searchText: makeSearchText(title, description),
      price: args.price,
      imageUrl: primaryImageUrl,
      images: fallbackImages,
      imageStorageIds,
      sizeInventory,
      category,
      isActive: args.isActive ?? true,
      popularityScore: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePoster = mutation({
  args: {
    actorAuthUserId: v.string(),
    posterId: v.id("posters"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    sizeInventory: v.optional(v.array(sizeInventoryItemValidator)),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const poster = await ctx.db.get(args.posterId);
    if (!poster) {
      throw new ConvexError("Poster not found");
    }

    if (args.price !== undefined && args.price < 0) {
      throw new ConvexError("Price must be non-negative");
    }

    const nextTitle = args.title?.trim() ?? poster.title;
    const nextDescription = args.description?.trim() ?? poster.description;
    const nextImageUrl = args.imageUrl?.trim() ?? poster.imageUrl;
    const nextImages = args.images
      ? normalizeImageList([nextImageUrl, ...args.images])
      : normalizeImageList([nextImageUrl, ...(poster.images ?? [])]);
    const nextStorageIds =
      args.imageStorageIds !== undefined
        ? normalizeStorageIds(args.imageStorageIds)
        : poster.imageStorageIds;
    const nextSizeInventory =
      args.sizeInventory !== undefined
        ? normalizeSizeInventory(args.sizeInventory)
        : poster.sizeInventory;
    const nextCategory = args.category?.trim() ?? poster.category;

    if (!nextTitle || !nextDescription || !nextCategory) {
      throw new ConvexError("Poster fields cannot be empty");
    }

    if (
      !nextImageUrl &&
      nextImages.length === 0 &&
      (!nextStorageIds || nextStorageIds.length === 0)
    ) {
      throw new ConvexError("Add at least one image URL or upload an image");
    }

    const safeNextImages = normalizeImageList([nextImageUrl, ...nextImages]);

    await ctx.db.patch(args.posterId, {
      title: nextTitle,
      description: nextDescription,
      searchText: makeSearchText(nextTitle, nextDescription),
      price: args.price ?? poster.price,
      imageUrl: safeNextImages[0] ?? "",
      images: safeNextImages,
      imageStorageIds: nextStorageIds,
      sizeInventory: nextSizeInventory,
      category: nextCategory,
      isActive: args.isActive ?? poster.isActive,
      updatedAt: Date.now(),
    });

    return args.posterId;
  },
});

export const deletePoster = mutation({
  args: {
    actorAuthUserId: v.string(),
    posterId: v.id("posters"),
  },
  handler: async (ctx, args) => {
    await requireAdminByAuthUserId(ctx, args.actorAuthUserId);

    const poster = await ctx.db.get(args.posterId);
    if (!poster) {
      throw new ConvexError("Poster not found");
    }

    await ctx.db.patch(args.posterId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return args.posterId;
  },
});
