"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useStoreCart } from "@/lib/storefront/cart";

export function AddToCart({
  slug,
  product,
}: {
  slug: string;
  product: {
    productId: string;
    name: string;
    price: number;
    imageUrl: string | null;
    minSeats: number;
    maxSeats: number | null;
  };
}) {
  const router = useRouter();
  const { addItem, items } = useStoreCart(slug);
  const [added, setAdded] = useState(false);
  const min = Math.max(1, product.minSeats || 1);
  const max = product.maxSeats ?? null;
  const [seats, setSeats] = useState(min);
  const inCart = items.some((i) => i.productId === product.productId);

  const clamp = (n: number) => {
    let q = Math.max(n, min);
    if (max != null) q = Math.min(q, max);
    return q;
  };

  const cartItem = {
    productId: product.productId,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    minSeats: min,
    maxSeats: max,
  };

  const limitLabel =
    max != null
      ? `This course seats ${min}–${max} participants.`
      : `Minimum ${min} ${min === 1 ? "participant" : "participants"}.`;

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Seats (employees attending)
        </label>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-slate-200">
            <button
              type="button"
              aria-label="Fewer seats"
              onClick={() => setSeats((s) => clamp(s - 1))}
              disabled={seats <= min}
              className="h-10 w-10 flex items-center justify-center rounded-l-full hover:bg-slate-50 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={seats}
              min={min}
              max={max ?? undefined}
              onChange={(e) => setSeats(clamp(parseInt(e.target.value) || min))}
              className="w-16 text-center font-semibold border-0 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              aria-label="More seats"
              onClick={() => setSeats((s) => clamp(s + 1))}
              disabled={max != null && seats >= max}
              className="h-10 w-10 flex items-center justify-center rounded-r-full hover:bg-slate-50 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span className="text-xs text-slate-500">{limitLabel}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {
            addItem(cartItem, seats);
            setAdded(true);
            setTimeout(() => setAdded(false), 1800);
          }}
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-white font-semibold text-base hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          {added ? (
            <>
              <Check className="h-5 w-5" /> Added!
            </>
          ) : (
            <>
              <ShoppingBag className="h-5 w-5" /> {inCart ? "Add more seats" : "Add to cart"}
            </>
          )}
        </button>
        <button
          onClick={() => {
            addItem(cartItem, seats);
            router.push(`/store/${slug}/cart`);
          }}
          className="inline-flex items-center justify-center px-8 py-3.5 rounded-full font-semibold text-base border-2 hover:bg-slate-50 transition-colors"
          style={{ borderColor: "var(--store-primary)", color: "var(--store-primary)" }}
        >
          Buy now
        </button>
      </div>
    </div>
  );
}
