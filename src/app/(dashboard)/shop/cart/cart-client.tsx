"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import CheckoutForm from "@/components/shop/checkout-form";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function CartClient() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/cart");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  async function removeItem(productId: string) {
    await fetch(`/api/shop/cart?product_id=${productId}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.product?.id !== productId));
    window.dispatchEvent(new Event("cart-updated"));
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch("/api/shop/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon(data.coupon);
      } else {
        setCouponError(data.reason || data.error || "Invalid coupon");
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  // Calculate totals
  const now = new Date();
  const subtotal = items.reduce((sum, item) => {
    const p = item.product;
    if (!p) return sum;
    const hasDiscount = p.discount_price != null && p.discount_ends_at && new Date(p.discount_ends_at) > now;
    return sum + (hasDiscount ? p.discount_price : p.price);
  }, 0);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === "percentage") {
      discount = Math.round(subtotal * (appliedCoupon.discount_value / 100) * 100) / 100;
    } else {
      discount = Math.min(appliedCoupon.discount_value, subtotal);
    }
  }
  const total = Math.max(0, subtotal - discount);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-24 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-500 mt-1">{items.length} item{items.length !== 1 ? "s" : ""} in your cart</p>
        </div>
        <Link href="/shop" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
          Continue Shopping
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Your cart is empty</h3>
          <p className="text-gray-500 mb-4">Browse the marketplace to find courses</p>
          <Link
            href="/shop"
            className="inline-flex px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const p = item.product;
              if (!p) return null;
              const hasDisc = p.discount_price != null && p.discount_ends_at && new Date(p.discount_ends_at) > now;
              const price = hasDisc ? p.discount_price : p.price;

              return (
                <div
                  key={item.id}
                  className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="w-28 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg overflow-hidden shrink-0">
                    {p.course?.thumbnail_url ? (
                      <img src={p.course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {p.course?.title || "Unknown Course"}
                    </h3>
                    {p.course?.short_description && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{p.course.short_description}</p>
                    )}
                    <button
                      onClick={() => removeItem(p.id)}
                      className="text-sm text-red-500 hover:text-red-700 mt-2 font-medium"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-gray-900">{formatPrice(price)}</div>
                    {hasDisc && (
                      <div className="text-sm text-gray-400 line-through">{formatPrice(p.price)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar: Order Summary or Checkout */}
          <div className="lg:col-span-1">
            {showCheckout ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-4"
                >
                  &larr; Back to summary
                </button>
                <CheckoutForm
                  items={items}
                  subtotal={subtotal}
                  discount={discount}
                  total={total}
                  couponCode={appliedCoupon?.code || null}
                />
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 sticky top-24">
                <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal ({items.length} items)</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Coupon */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {couponLoading ? "..." : "Apply"}
                    </button>
                  </div>
                  {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                  {appliedCoupon && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                        {appliedCoupon.code} applied
                        {appliedCoupon.discount_type === "percentage"
                          ? ` (${appliedCoupon.discount_value}% off)`
                          : ` ($${appliedCoupon.discount_value} off)`}
                      </span>
                      <button
                        onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
