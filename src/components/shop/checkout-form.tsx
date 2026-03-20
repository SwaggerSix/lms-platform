"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CartItem {
  id: string;
  product: {
    id: string;
    price: number;
    discount_price: number | null;
    discount_ends_at: string | null;
    course: {
      id: string;
      title: string;
      thumbnail_url?: string;
    };
  };
}

interface CheckoutFormProps {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
}

export default function CheckoutForm({
  items,
  subtotal,
  discount,
  total,
  couponCode,
}: CheckoutFormProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  function formatPrice(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setProcessing(true);

    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method: "card",
          coupon_code: couponCode || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Checkout failed");
        setProcessing(false);
        return;
      }

      setSuccess(true);
      window.dispatchEvent(new Event("cart-updated"));

      setTimeout(() => {
        router.push("/shop/orders");
      }, 2000);
    } catch {
      setError("An unexpected error occurred");
      setProcessing(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Order Complete!</h3>
        <p className="text-gray-500">You have been enrolled in your purchased courses.</p>
        <p className="text-sm text-gray-400 mt-2">Redirecting to your orders...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-900">Order Summary</h3>
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-gray-600 truncate mr-4">{item.product.course.title}</span>
            <span className="text-gray-900 font-medium whitespace-nowrap">
              {formatPrice(item.product.discount_price && item.product.discount_ends_at && new Date(item.product.discount_ends_at) > new Date()
                ? item.product.discount_price
                : item.product.price)}
            </span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatPrice(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base pt-1">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      {/* Payment Details (Simulated) */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Payment Details</h3>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This is a simulated checkout. No real payment will be processed.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
          <input
            type="text"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())}
            maxLength={19}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
            <input
              type="text"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, "");
                if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2, 4);
                setExpiry(v);
              }}
              maxLength={5}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
            <input
              type="text"
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={processing}
        className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? "Processing..." : `Pay ${formatPrice(total)}`}
      </button>

      <p className="text-center text-xs text-gray-400">
        By completing this purchase you agree to the Terms of Service.
        {/* Stripe integration placeholder: replace simulated flow with Stripe Elements */}
      </p>
    </form>
  );
}
