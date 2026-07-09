"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock } from "lucide-react";

interface Product {
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

function formatPrice(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const now = new Date();
  const hasDiscount =
    product.discount_price != null &&
    product.discount_ends_at &&
    new Date(product.discount_ends_at) > now;

  const effectivePrice = hasDiscount ? product.discount_price! : product.price;

  // Shop display prefers product-level overrides, falling back to the course.
  const displayTitle = product.name || product.course.title;
  const displayImage = product.image_url || product.course.thumbnail_url;
  const displayDescription = product.description || product.course.short_description;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      if (res.ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add");
        setTimeout(() => setError(""), 3000);
      }
    } catch {
      setError("Network error");
      setTimeout(() => setError(""), 3000);
    } finally {
      setAdding(false);
    }
  }

  const difficultyColors: Record<string, string> = {
    beginner: "bg-green-100 text-green-700",
    intermediate: "bg-yellow-100 text-yellow-700",
    advanced: "bg-red-100 text-red-700",
  };

  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
      onClick={() => router.push("/shop/" + product.id)}>
        {/* Featured badge */}
        {product.is_featured && (
          <div className="absolute top-3 left-3 z-10 bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            Featured
          </div>
        )}

        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute top-3 right-3 z-10 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            {Math.round(((product.price - product.discount_price!) / product.price) * 100)}% OFF
          </div>
        )}

        {/* Thumbnail */}
        <div className="aspect-video bg-gradient-to-br from-primary-100 to-purple-100 relative overflow-hidden">
          {displayImage ? (
            <img
              src={displayImage}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-primary-300" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Category & Difficulty */}
          <div className="flex items-center gap-2 flex-wrap">
            {product.course.category && (
              <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                {product.course.category.name}
              </span>
            )}
            {product.course.difficulty_level && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${difficultyColors[product.course.difficulty_level] || "bg-gray-100 text-gray-600"}`}>
                {product.course.difficulty_level}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
            {displayTitle}
          </h3>

          {/* Description */}
          {displayDescription && (
            <p className="text-sm text-gray-500 line-clamp-2">
              {displayDescription}
            </p>
          )}

          {/* Duration & Sales */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {product.course.estimated_duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {product.course.estimated_duration}h
              </span>
            )}
            {product.sales_count > 0 && (
              <span>{product.sales_count.toLocaleString()} enrolled</span>
            )}
          </div>

          {/* Price + Add to Cart */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(effectivePrice)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-gray-400 line-through">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>

            <button
              onClick={handleAddToCart}
              disabled={adding || added}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                error
                  ? "bg-red-100 text-red-700"
                  : added
                  ? "bg-green-100 text-green-700"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              } disabled:opacity-50`}
            >
              {error || (added ? "Added!" : adding ? "..." : "Add to Cart")}
            </button>
          </div>
        </div>
    </div>
  );
}
