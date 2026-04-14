import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useSessionStore } from "#/stores/sessionStore";
import { toast } from "#/stores/toastStore";

type AllowedSize = "S" | "M" | "L" | "XL" | "A4" | "A3" | "A2";
const allowedSizes: AllowedSize[] = ["S", "M", "L", "XL", "A4", "A3", "A2"];

type ImageItem = {
  storageId: Id<"_storage">;
  preview: string | null; // object URL (new uploads) or hydrated URL (edit mode)
};

type PosterFormData = {
  title: string;
  description: string;
  category: string;
  sizeInventoryText: string;
  price: string;
};

type PosterInput = {
  _id: Id<"posters">;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  images?: string[];
  imageStorageIds?: Id<"_storage">[];
  sizeInventory?: { size: AllowedSize; stock: number }[];
  price: number;
};

const initialForm: PosterFormData = {
  title: "",
  description: "",
  category: "",
  sizeInventoryText: "",
  price: "",
};

function parseSizeInventoryInput(
  value: string,
): { size: AllowedSize; stock: number }[] {
  const rows = value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const parsed: { size: AllowedSize; stock: number }[] = [];
  for (const row of rows) {
    const [rawSize, rawStock] = row.split(":").map((entry) => entry?.trim());
    if (!rawSize || rawStock === undefined) {
      throw new Error(
        "Each size row must follow SIZE:STOCK format (example: A3:10)",
      );
    }

    if (!allowedSizes.includes(rawSize as AllowedSize)) {
      throw new Error(
        `Invalid size "${rawSize}". Allowed: ${allowedSizes.join(", ")}`,
      );
    }

    const stock = Number(rawStock);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error(`Stock for ${rawSize} must be a non-negative integer`);
    }

    parsed.push({ size: rawSize as AllowedSize, stock });
  }

  return parsed;
}

function toFormValue(poster: PosterInput): PosterFormData {
  return {
    title: poster.title,
    description: poster.description,
    category: poster.category,
    sizeInventoryText: (poster.sizeInventory ?? [])
      .map((entry) => `${entry.size}:${entry.stock}`)
      .join("\n"),
    price: String(poster.price),
  };
}

type PosterEditorFormProps = {
  mode: "create" | "edit";
  initialPoster?: PosterInput;
};

export default function PosterEditorForm({
  mode,
  initialPoster,
}: PosterEditorFormProps) {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createPoster = useMutation(api.posters.createPoster);
  const updatePoster = useMutation(api.posters.updatePoster);

  const [form, setForm] = useState<PosterFormData>(
    initialPoster ? toFormValue(initialPoster) : initialForm,
  );
  const [imageItems, setImageItems] = useState<ImageItem[]>(
    (initialPoster?.imageStorageIds ?? []).map((storageId, i) => ({
      storageId,
      preview: initialPoster?.images?.[i] ?? null,
    })),
  );
  const previewUrls = useRef<string[]>([]);
  const dragIndex = useRef<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryInputRef = useRef<HTMLDivElement | null>(null);

  const categoriesData = useQuery(api.posters.getCategories, {});
  const categories = categoriesData ?? [];
  const filteredCategories = categories.filter((cat) =>
    cat.toLowerCase().includes(form.category.toLowerCase()),
  );

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        categoryInputRef.current &&
        !categoryInputRef.current.contains(event.target as Node)
      ) {
        setShowCategorySuggestions(false);
      }
    }

    if (showCategorySuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showCategorySuggestions]);

  useEffect(() => {
    if (!initialPoster) {
      setForm(initialForm);
      setImageItems([]);
      return;
    }

    setForm(toFormValue(initialPoster));
    setImageItems(
      (initialPoster.imageStorageIds ?? []).map((storageId, i) => ({
        storageId,
        preview: initialPoster.images?.[i] ?? null,
      })),
    );
  }, [initialPoster]);

  async function uploadFiles(fileList: FileList | null) {
    if (
      !fileList ||
      fileList.length === 0 ||
      !session ||
      session.role !== "admin"
    ) {
      return;
    }

    setActionError(null);
    setIsUploading(true);

    try {
      const uploaded: ImageItem[] = [];

      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith("image/")) {
          throw new Error("Only image files are supported");
        }

        const preview = URL.createObjectURL(file);
        previewUrls.current.push(preview);
        const uploadUrl = await generateUploadUrl({
          actorAuthUserId: session.authUserId,
        });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!response.ok) {
          URL.revokeObjectURL(preview);
          throw new Error("Image upload failed. Please try again.");
        }

        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        uploaded.push({ storageId, preview });
      }

      setImageItems((prev) => {
        const existing = new Set(prev.map((item) => item.storageId));
        return [
          ...prev,
          ...uploaded.filter((item) => !existing.has(item.storageId)),
        ];
      });
      toast.success("Upload complete", `${uploaded.length} image(s) uploaded`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to upload image";
      setActionError(message);
      toast.error("Upload failed", message);
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }

  function onItemDragStart(index: number) {
    dragIndex.current = index;
  }
  function onItemDragOver(event: React.DragEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    const from = dragIndex.current;
    if (from === null || from === index) return;
    setImageItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndex.current = index;
  }
  function onItemDragEnd() {
    dragIndex.current = null;
  }
  function removeImage(index: number) {
    setImageItems((prev) => prev.filter((_, i) => i !== index));
  }

  function onDropUpload(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.types.includes("Files")) {
      void uploadFiles(event.dataTransfer.files);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || session.role !== "admin") {
      return;
    }

    const parsedPrice = Number(form.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setActionError("Price must be a non-negative number");
      toast.error("Validation error", "Price must be a non-negative number");
      return;
    }

    let sizeInventory: { size: AllowedSize; stock: number }[];
    try {
      sizeInventory = parseSizeInventoryInput(form.sizeInventoryText);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid inventory input";
      setActionError(message);
      toast.error("Validation error", message);
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      if (mode === "edit" && initialPoster) {
        await updatePoster({
          actorAuthUserId: session.authUserId,
          posterId: initialPoster._id,
          title: form.title,
          description: form.description,
          category: form.category,
          imageStorageIds: imageItems.map((item) => item.storageId),
          sizeInventory,
          price: parsedPrice,
        });
        toast.success("Poster updated", `${form.title} is now up to date.`);
      } else {
        await createPoster({
          actorAuthUserId: session.authUserId,
          title: form.title,
          description: form.description,
          category: form.category,
          imageStorageIds: imageItems.map((item) => item.storageId),
          sizeInventory,
          price: parsedPrice,
          isActive: true,
        });
        toast.success("Poster created", `${form.title} has been added.`);
      }

      await navigate({ to: "/admin/posters" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save poster";
      setActionError(message);
      toast.error("Save failed", message);
    } finally {
      setSubmitting(false);
    }
  }

  const heading = mode === "edit" ? "Edit poster" : "Create poster";

  return (
    <section className="island-shell rounded-2xl p-6">
      <p className="island-kicker mb-2">Admin</p>
      <h1 className="m-0 text-3xl font-bold">{heading}</h1>
      <p className="mt-3 text-sm text-[var(--sea-ink-soft)]">
        Configure title, media, inventory, and pricing in one place.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 grid gap-3 rounded-xl border border-[var(--line)] p-4 sm:grid-cols-2"
      >
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
            Title
          </span>
          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
            className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5"
          />
        </label>

        <div className="relative" ref={categoryInputRef}>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
              Category
            </span>
            <input
              required
              value={form.category}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, category: event.target.value }));
                setShowCategorySuggestions(true);
              }}
              onFocus={() => setShowCategorySuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowCategorySuggestions(false), 200);
              }}
              placeholder="Type or select category"
              className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5"
            />
          </label>

          {showCategorySuggestions && form.category.length > 0 && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-lg">
              {filteredCategories.length > 0 && (
                <>
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, category: cat }));
                        setShowCategorySuggestions(false);
                      }}
                      className="block w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--line)] focus:bg-[var(--line)] transition-colors"
                    >
                      {cat}
                    </button>
                  ))}
                  <div className="border-t border-[var(--line)]" />
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowCategorySuggestions(false);
                }}
                className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-[var(--sea-ink-soft)] hover:bg-[var(--line)] focus:bg-[var(--line)] transition-colors"
              >
                ✓ Create "{form.category}"
              </button>
            </div>
          )}
        </div>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
            Price
          </span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, price: event.target.value }))
            }
            className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5"
          />
        </label>

        <div className="sm:col-span-2 space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDropUpload}
            className="rounded-lg border border-dashed border-[var(--line)] p-4"
          >
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sea-ink-soft)]">
              Uploaded images
            </p>
            <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
              Drop image files here or choose from disk. Drag thumbnails to
              reorder — first is the cover.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => uploadInputRef.current?.click()}
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-60"
              >
                {isUploading ? "Uploading..." : "Choose files"}
              </button>
              {isUploading && (
                <span className="text-xs text-[var(--sea-ink-soft)]">
                  Uploading…
                </span>
              )}
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                void uploadFiles(event.target.files);
              }}
              className="hidden"
            />
          </div>

          {/* Reorderable image grid */}
          {imageItems.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {imageItems.map((item, index) => (
                <div
                  key={item.storageId}
                  draggable
                  onDragStart={() => onItemDragStart(index)}
                  onDragOver={(e) => onItemDragOver(e, index)}
                  onDragEnd={onItemDragEnd}
                  onDrop={(e) => e.stopPropagation()}
                  className="group relative aspect-[3/4] cursor-grab overflow-hidden rounded-lg border border-[var(--line)] active:cursor-grabbing"
                >
                  {item.preview ? (
                    <img
                      src={item.preview}
                      alt={`Image ${index + 1}`}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--surface)]">
                      <span className="font-mono text-[10px] text-[var(--sea-ink-soft)]">
                        {item.storageId.slice(-6)}
                      </span>
                    </div>
                  )}

                  {/* Primary badge */}
                  {index === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                      Cover
                    </span>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label="Remove image"
                    className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                  >
                    ✕
                  </button>

                  {/* Drag hint dots */}
                  <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-70">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-1 w-1 rounded-full bg-white" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
            Size Inventory
          </span>
          <textarea
            rows={3}
            placeholder={"A4:10\nA3:8\nA2:3"}
            value={form.sizeInventoryText}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                sizeInventoryText: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
            Description
          </span>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5"
          />
        </label>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary disabled:opacity-60"
          >
            {submitting
              ? "Saving..."
              : mode === "edit"
                ? "Update poster"
                : "Create poster"}
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/admin/posters" })}
            className="rounded-md border border-[var(--line)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
          >
            Cancel
          </button>
        </div>
      </form>

      {actionError ? (
        <p className="mt-4 text-sm text-rose-300">{actionError}</p>
      ) : null}
    </section>
  );
}
