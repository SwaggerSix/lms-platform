"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import ProductCard from "@/components/shop/product-card";

interface StoreProduct {
  id: string;
  price: number;
  discount_price: number | null;
  discount_ends_at: string | null;
  is_featured: boolean;
  sales_count: number;
  status: string;
  name?: string | null;
  description?: string | null;
  image_url?: string | null;
  course: {
    id: string;
    title: string;
    short_description?: string;
    thumbnail_url?: string;
    difficulty_level?: string;
    estimated_duration?: number;
    category?: { id: string; name: string } | null;
  };
}

/**
 * Store tab of the unified catalog: purchasable courses. Self-loads on mount
 * and re-queries when the shared catalog search changes. Cards link into the
 * existing /shop/[productId] detail and cart flow.
 */
export default function StoreProductsTab({ search }: { search: string }) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(
    async (pageNum: number, searchQuery: string, sortBy: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: "active",
          listed: "true",
          page: String(pageNum),
          limit: "12",
          sort: sortBy,
        });
        if (searchQuery) params.set("search", searchQuery);
        const res = await fetch(`/api/shop/products?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setProducts(Array.isArray(data.products) ? data.products : []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        console.error("Failed to load store products:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load + debounced re-query when the shared search or sort changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts(1, search, sort);
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, sort, fetchProducts]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {total} course{total === 1 ? "" : "s"} available for purchase
        </p>
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most Popular</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
          <Link
            href="/shop/cart"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            View Cart
          </Link>
        </div>
      </div>

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-gray-100 bg-white">
              <div className="aspect-video bg-gray-200" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="mt-3 h-8 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" aria-hidden="true" />}
          title="No courses in the store"
          description={
            search
              ? "Try adjusting your search."
              : "Purchasable courses appear here once they are published to the store."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => {
                  const prev = page - 1;
                  setPage(prev);
                  fetchProducts(prev, search, sort);
                }}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  fetchProducts(next, search, sort);
                }}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
