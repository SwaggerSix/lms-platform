"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard from "@/components/shop/product-card";

interface Props {
  featured: any[];
  products: any[];
  categories: { id: string; name: string }[];
  total: number;
  page: number;
  totalPages: number;
  currentSort: string;
  currentCategory: string;
  currentSearch: string;
}

export default function ShopClient({
  featured,
  products,
  categories,
  total,
  page,
  totalPages,
  currentSort,
  currentCategory,
  currentSearch,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams();
    const current: Record<string, string> = {
      sort: currentSort,
      category: currentCategory,
      search: currentSearch,
      page: String(page),
    };
    const merged = { ...current, ...updates };
    if (updates.sort || updates.category || updates.search) merged.page = "1";
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Course Marketplace</h1>
        <p className="text-gray-500 mt-1">Browse and purchase courses to advance your learning</p>
      </div>

      {/* Featured Section */}
      {featured.length > 0 && page === 1 && !currentSearch && !currentCategory && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-gray-900">Featured Courses</h2>
            <span className="text-sm text-indigo-600 font-medium">{featured.length} courses</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateParams({ search });
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={currentCategory}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={currentSort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="newest">Newest</option>
          <option value="popular">Most Popular</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">{total} course{total !== 1 ? "s" : ""} available</p>

      {/* Product Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p: any) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No courses found</h3>
          <p className="text-gray-500">Try adjusting your filters or search terms</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
            disabled={page <= 1}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const p = start + i;
            return (
              <button
                key={p}
                onClick={() => updateParams({ page: String(p) })}
                className={`w-10 h-10 text-sm rounded-lg font-medium ${
                  p === page
                    ? "bg-indigo-600 text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => updateParams({ page: String(Math.min(totalPages, page + 1)) })}
            disabled={page >= totalPages}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
