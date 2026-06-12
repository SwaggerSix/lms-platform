"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatPrice } from "@/lib/ecommerce/pricing";

export interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  category: string | null;
  isFeatured: boolean;
}

export function ProductCard({ slug, product }: { slug: string; product: CatalogProduct }) {
  const onSale = product.discountPrice != null;
  return (
    <Link
      href={`/store/${slug}/product/${product.id}`}
      className="group flex flex-col rounded-2xl border border-slate-200 overflow-hidden bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center text-4xl font-bold text-white/90"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            {product.name.charAt(0)}
          </div>
        )}
        {onSale && (
          <span
            className="absolute top-3 left-3 text-xs font-semibold text-white px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "var(--store-accent)" }}
          >
            Sale
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        {product.category && (
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
            {product.category}
          </div>
        )}
        <h3 className="font-semibold text-slate-900 leading-snug">{product.name}</h3>
        {product.description && (
          <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto pt-4 flex items-baseline gap-2">
          {product.price > 0 ? (
            <>
              <span className="text-lg font-bold" style={{ color: "var(--store-primary)" }}>
                {formatPrice(product.discountPrice ?? product.price)}
              </span>
              {onSale && (
                <span className="text-sm text-slate-400 line-through">{formatPrice(product.price)}</span>
              )}
            </>
          ) : (
            <span className="text-sm font-semibold" style={{ color: "var(--store-primary)" }}>
              Contact us for pricing
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function CatalogClient({ slug, products }: { slug: string; products: CatalogProduct[] }) {
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q))
    );
  }, [products, category, search]);

  const featured = filtered.filter((p) => p.isFeatured);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              !category
                ? "text-white border-transparent"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            style={!category ? { backgroundColor: "var(--store-primary)" } : undefined}
          >
            All courses
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c === category ? null : c)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                category === c
                  ? "text-white border-transparent"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
              style={category === c ? { backgroundColor: "var(--store-primary)" } : undefined}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            className="w-full pl-9 pr-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>

      {featured.length > 0 && !category && !search && (
        <section className="mt-10">
          <h2 className="text-xl font-bold mb-4">Featured</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} slug={slug} product={p} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            No courses match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered
              .filter((p) => !(featured.includes(p) && !category && !search))
              .map((p) => (
                <ProductCard key={p.id} slug={slug} product={p} />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
