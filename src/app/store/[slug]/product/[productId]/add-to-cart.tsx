"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingBag } from "lucide-react";
import { useStoreCart } from "@/lib/storefront/cart";

export function AddToCart({
  slug,
  product,
}: {
  slug: string;
  product: { productId: string; name: string; price: number; imageUrl: string | null };
}) {
  const router = useRouter();
  const { addItem, items } = useStoreCart(slug);
  const [added, setAdded] = useState(false);
  const inCart = items.some((i) => i.productId === product.productId);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={() => {
          if (!inCart) addItem(product);
          setAdded(true);
          setTimeout(() => setAdded(false), 1800);
        }}
        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-white font-semibold text-base hover:opacity-90 transition-opacity"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        {added || inCart ? (
          <>
            <Check className="h-5 w-5" /> {inCart && !added ? "In your cart" : "Added!"}
          </>
        ) : (
          <>
            <ShoppingBag className="h-5 w-5" /> Add to cart
          </>
        )}
      </button>
      <button
        onClick={() => {
          if (!inCart) addItem(product);
          router.push(`/store/${slug}/cart`);
        }}
        className="inline-flex items-center justify-center px-8 py-3.5 rounded-full font-semibold text-base border-2 hover:bg-slate-50 transition-colors"
        style={{ borderColor: "var(--store-primary)", color: "var(--store-primary)" }}
      >
        Buy now
      </button>
    </div>
  );
}
