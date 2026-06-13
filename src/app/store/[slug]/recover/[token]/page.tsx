"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setCartItems, type StoreCartItem } from "@/lib/storefront/cart";

// Recovery landing for abandoned-cart emails: restores the saved cart into the
// browser and forwards the client to checkout with the recovery token so the
// completed order is attributed to the recovery.
export default function RecoverCartPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = use(params);
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/storefront/cart/recover?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        const items = (data.items || []) as StoreCartItem[];
        if (items.length === 0) {
          setError(true);
          return;
        }
        setCartItems(slug, items);
        router.replace(`/store/${slug}/cart?recover=${encodeURIComponent(token)}`);
      } catch {
        setError(true);
      }
    })();
  }, [slug, token, router]);

  return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center">
      {error ? (
        <>
          <h1 className="text-2xl font-bold">This link has expired</h1>
          <p className="mt-2 text-slate-600">
            Your saved cart is no longer available, but the catalog is ready when you are.
          </p>
          <a
            href={`/store/${slug}`}
            className="mt-6 inline-flex px-6 py-3 rounded-full text-white font-semibold"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            Browse courses
          </a>
        </>
      ) : (
        <p className="text-slate-600">Restoring your cart…</p>
      )}
    </div>
  );
}
