import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { formatPrice } from "#/lib/format";
import { useCartStore } from "#/stores/cartStore";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "#/components/ui/carousel";

export const Route = createFileRoute("/poster/$posterId")({
  component: PosterDetailPage,
});

function PosterDetailPage() {
  const { posterId } = Route.useParams();
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);

  const poster = useQuery(api.posters.getPosterById, {
    posterId: posterId as Id<"posters">,
  });

  const images = useMemo(() => {
    if (!poster) return [] as string[];
    return poster.images?.length ? poster.images : [poster.imageUrl];
  }, [poster]);

  const availableSizes = useMemo(() => {
    if (!poster) return [] as { size: string; stock: number }[];
    return (poster.sizeInventory ?? []).filter((entry) => entry.stock > 0);
  }, [poster]);

  // sync carousel events → currentIndex
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrentIndex(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    onSelect();
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  // reset index when images list changes (e.g. navigation)
  useEffect(() => {
    setCurrentIndex(0);
    carouselApi?.scrollTo(0, true);
  }, [images, carouselApi]);

  useEffect(() => {
    if (availableSizes.length === 0) {
      setSelectedSize("");
      return;
    }
    const hasCurrent = availableSizes.some(
      (entry) => entry.size === selectedSize,
    );
    if (!hasCurrent) {
      setSelectedSize(availableSizes[0].size);
    }
  }, [availableSizes, selectedSize]);

  if (poster === undefined) {
    return (
      <main className="page-wrap px-4 py-10">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading poster...</p>
      </main>
    );
  }

  if (poster === null) {
    return (
      <main className="page-wrap px-4 py-10">
        <section className="island-shell rounded-2xl p-6">
          <h1 className="m-0 text-2xl font-semibold">Poster not found</h1>
          <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
            This poster is unavailable or inactive.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold">
            Back to marketplace
          </Link>
        </section>
      </main>
    );
  }

  const selectedSizeStock = availableSizes.find(
    (entry) => entry.size === selectedSize,
  )?.stock;
  const maxQuantity = selectedSizeStock ?? 99;
  const activeImage = images[currentIndex] ?? images[0] ?? poster.imageUrl;

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell grid gap-6 rounded-md p-6 lg:grid-cols-[1.15fr_1fr]">
        {/* ── Image panel ── */}
        <div>
          {images.length > 1 ? (
            <div>
              <Carousel
                opts={{ loop: true }}
                setApi={setCarouselApi}
                className="w-full"
              >
                <CarouselContent className="-ml-0">
                  {images.map((image, i) => (
                    <CarouselItem key={image} className="pl-0">
                      <div className="overflow-hidden rounded-md bg-[var(--surface)]">
                        <img
                          src={image}
                          alt={`${poster.title} — image ${i + 1}`}
                          className="min-h-[420px] w-full object-cover"
                          draggable={false}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>

                {/* Prev / Next — inset so they sit inside the image */}
                <CarouselPrevious className="left-3 border-white/30 bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white" />
                <CarouselNext className="right-3 border-white/30 bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white" />
              </Carousel>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md bg-[var(--surface)]">
              <img
                src={images[0] ?? poster.imageUrl}
                alt={poster.title}
                className="min-h-[420px] w-full object-cover"
              />
            </div>
          )}
        </div>

        {/* ── Details panel ── */}
        <div>
          <p className="island-kicker mb-2">Poster Detail</p>
          <h1 className="m-0 text-4xl font-bold tracking-[-0.01em] text-[var(--sea-ink)]">
            {poster.title}
          </h1>
          <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-[var(--sea-ink-soft)]">
            {poster.description}
          </p>

          <div className="mt-5 flex items-center justify-between rounded-md border border-[var(--line)] p-4">
            <span className="text-sm text-[var(--sea-ink-soft)]">Price</span>
            <strong className="text-xl">{formatPrice(poster.price)}</strong>
          </div>

          {availableSizes.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-[var(--sea-ink-soft)]">
                Size
              </p>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((entry) => (
                  <button
                    key={entry.size}
                    type="button"
                    onClick={() => setSelectedSize(entry.size)}
                    className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                      selectedSize === entry.size
                        ? "border-[var(--sea-ink)] bg-[var(--surface)]"
                        : "border-[var(--line)]"
                    }`}
                  >
                    {entry.size} ({entry.stock})
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <label
              className="text-sm font-medium text-[var(--sea-ink-soft)]"
              htmlFor="quantity"
            >
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.min(
                    maxQuantity,
                    Math.max(1, Number(event.target.value) || 1),
                  ),
                )
              }
              className="w-24 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={availableSizes.length > 0 && !selectedSize}
              onClick={() =>
                addItem({
                  posterId: poster._id,
                  title: poster.title,
                  imageUrl: activeImage,
                  price: poster.price,
                  quantity,
                  selectedSize: selectedSize || undefined,
                })
              }
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-opacity disabled:opacity-50"
            >
              Add to Cart
            </button>
            <Link to="/cart" className="cta-link">
              Go to Cart
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
