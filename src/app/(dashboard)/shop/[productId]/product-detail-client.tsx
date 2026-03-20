"use client";

import { useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/shop/product-card";

interface Props {
  product: any;
  instructor: any;
  relatedProducts: any[];
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function ProductDetailClient({ product, instructor, relatedProducts }: Props) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const now = new Date();
  const hasDiscount =
    product.discount_price != null &&
    product.discount_ends_at &&
    new Date(product.discount_ends_at) > now;
  const effectivePrice = hasDiscount ? product.discount_price : product.price;

  async function handleAddToCart() {
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
        window.dispatchEvent(new Event("cart-updated"));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add to cart");
      }
    } catch {
      setError("An error occurred");
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/shop" className="hover:text-indigo-600">Marketplace</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{product.course.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Image */}
          <div className="aspect-video bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl overflow-hidden">
            {product.course.thumbnail_url ? (
              <img
                src={product.course.thumbnail_url}
                alt={product.course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-20 h-20 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {product.course.category && (
              <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                {product.course.category.name}
              </span>
            )}
            {product.course.difficulty_level && (
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${difficultyColors[product.course.difficulty_level] || "bg-gray-100 text-gray-600"}`}>
                {product.course.difficulty_level.charAt(0).toUpperCase() + product.course.difficulty_level.slice(1)}
              </span>
            )}
            {product.course.course_type && (
              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {product.course.course_type.replace("_", " ")}
              </span>
            )}
            {product.is_featured && (
              <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                Featured
              </span>
            )}
          </div>

          {/* Title & Description */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              {product.course.title}
            </h1>
            {product.course.short_description && (
              <p className="text-lg text-gray-600 mb-4">{product.course.short_description}</p>
            )}
            {product.course.description && (
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-600 whitespace-pre-line">{product.course.description}</p>
              </div>
            )}
          </div>

          {/* Course Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {product.course.estimated_duration && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{product.course.estimated_duration}h</div>
                <div className="text-sm text-gray-500 mt-1">Duration</div>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{product.sales_count.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">Enrolled</div>
            </div>
            {product.course.difficulty_level && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-gray-900 capitalize">{product.course.difficulty_level}</div>
                <div className="text-sm text-gray-500 mt-1">Level</div>
              </div>
            )}
          </div>

          {/* Reviews placeholder */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Reviews</h3>
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <p className="text-sm">No reviews yet. Be the first to review after purchasing!</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Purchase Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
            {/* Price */}
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-gray-900">{formatPrice(effectivePrice)}</span>
                {hasDiscount && (
                  <span className="text-lg text-gray-400 line-through">{formatPrice(product.price)}</span>
                )}
              </div>
              {hasDiscount && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                    {Math.round(((product.price - product.discount_price) / product.price) * 100)}% off
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    Sale ends {new Date(product.discount_ends_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Add to Cart */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
            )}

            {added ? (
              <div className="space-y-3">
                <div className="bg-green-50 text-green-700 text-sm font-medium rounded-xl px-4 py-3 text-center">
                  Added to cart!
                </div>
                <Link
                  href="/shop/cart"
                  className="block w-full text-center bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Go to Cart
                </Link>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={adding}
                className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add to Cart"}
              </button>
            )}

            <Link
              href="/shop/cart"
              className="block w-full text-center border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              View Cart
            </Link>

            {/* Instructor */}
            {instructor && (
              <div className="border-t border-gray-100 pt-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Instructor</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm">
                    {instructor.first_name?.charAt(0)}{instructor.last_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {instructor.first_name} {instructor.last_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{instructor.role}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Includes */}
            <div className="border-t border-gray-100 pt-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">This course includes</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Full lifetime access
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Certificate of completion
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Access on mobile and desktop
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Related Courses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
