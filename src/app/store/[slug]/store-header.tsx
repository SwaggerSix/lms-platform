"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useStoreCart } from "@/lib/storefront/cart";

export function StoreHeader({
  slug,
  name,
  logoUrl,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
}) {
  const { count } = useStoreCart(slug);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href={`/store/${slug}`} className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name} className="h-9 w-auto" />
          ) : (
            <span
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              {name.charAt(0)}
            </span>
          )}
          <span className="font-semibold text-lg truncate">{name}</span>
        </Link>
        <Link
          href={`/store/${slug}/cart`}
          className="relative flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-sm font-medium"
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Cart</span>
          {count > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full text-white text-xs flex items-center justify-center font-semibold"
              style={{ backgroundColor: "var(--store-accent)" }}
            >
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
