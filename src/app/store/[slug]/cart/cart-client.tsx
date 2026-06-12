"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2, Lock } from "lucide-react";
import { useStoreCart } from "@/lib/storefront/cart";
import { formatPrice } from "@/lib/ecommerce/pricing";

export function CartClient({ slug }: { slug: string }) {
  const { items, subtotal, setQuantity, removeItem } = useStoreCart(slug);
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "1";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/storefront/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storefront_slug: slug,
          customer_name: name,
          customer_email: email,
          coupon_code: couponCode.trim() || undefined,
          items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError("Could not reach the checkout service. Please try again.");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-slate-600">Browse the catalog to find your next course.</p>
        <Link
          href={`/store/${slug}`}
          className="mt-6 inline-flex px-6 py-3 rounded-full text-white font-semibold"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          View courses
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">Your cart</h1>
      {canceled && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
          Your payment was canceled — your cart is saved whenever you&apos;re ready.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 divide-y divide-slate-200 border-y border-slate-200">
          {items.map((item) => (
            <div key={item.productId} className="py-5 flex gap-4 items-center">
              <div className="h-20 w-28 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="h-full w-full flex items-center justify-center text-xl font-bold text-white/90"
                    style={{ backgroundColor: "var(--store-primary)" }}
                  >
                    {item.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{item.name}</div>
                <div className="text-sm text-slate-500">{formatPrice(item.price)} each</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center font-medium">{item.quantity}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="w-24 text-right font-semibold">
                {formatPrice(item.price * item.quantity)}
              </div>
              <button
                aria-label="Remove item"
                onClick={() => removeItem(item.productId)}
                className="text-slate-400 hover:text-red-500 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={checkout} className="rounded-2xl border border-slate-200 p-6 h-fit bg-slate-50/50">
          <h2 className="font-bold text-lg">Checkout</h2>
          <div className="mt-4 space-y-3">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address (for your receipt)"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
            />
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Discount code (optional)"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
            />
          </div>
          <div className="mt-5 pt-4 border-t border-slate-200 flex justify-between font-semibold">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Discounts and any tax are shown on the secure payment page.
          </p>
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            <Lock className="h-4 w-4" />
            {submitting ? "Redirecting…" : "Continue to secure payment"}
          </button>
          <p className="mt-3 text-xs text-slate-500 text-center">
            Payments are processed securely by Stripe. Card details never touch our servers.
          </p>
        </form>
      </div>
    </div>
  );
}
