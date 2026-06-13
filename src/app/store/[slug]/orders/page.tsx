"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/ecommerce/pricing";

interface LookupOrder {
  orderNumber: string;
  status: string;
  companyName: string | null;
  customerName: string | null;
  total: number;
  currency: string;
  poNumber: string | null;
  createdAt: string;
  items: { name: string; seats: number; price: number }[];
}

const statusStyles: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  cancelled: "bg-slate-200 text-slate-700",
  refunded: "bg-red-100 text-red-700",
  partially_refunded: "bg-orange-100 text-orange-800",
  failed: "bg-red-100 text-red-700",
};

export default function OrderHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orders, setOrders] = useState<LookupOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/storefront/order-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefront_slug: slug, email, order_number: orderNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Lookup failed.");
        setOrders(null);
      } else {
        setOrders(data.orders);
      }
    } catch {
      setError("Could not reach the lookup service.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white";

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold">Your orders</h1>
      <p className="mt-2 text-slate-600 text-sm">
        Enter your email and an order number from any confirmation email to view your order history.
      </p>

      <form onSubmit={lookup} className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Contact email"
          className={inputClass}
        />
        <input
          required
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order number (ORD-…)"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg text-white font-semibold text-sm px-4 py-2.5 disabled:opacity-60"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          {loading ? "Looking up…" : "View orders"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="mt-8 space-y-4">
          {orders.map((o) => (
            <div key={o.orderNumber} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold">{o.orderNumber}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(o.createdAt).toLocaleDateString()} · {o.companyName || o.customerName}
                    {o.poNumber ? ` · PO ${o.poNumber}` : ""}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[o.status] || "bg-slate-100 text-slate-700"}`}>
                  {o.status.replace("_", " ")}
                </span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {o.items.map((it, i) => (
                  <li key={i} className="py-2 flex justify-between">
                    <span>
                      {it.name} <span className="text-slate-400">× {it.seats} {it.seats === 1 ? "seat" : "seats"}</span>
                    </span>
                    <span className="text-slate-600">{formatPrice(it.price * it.seats, o.currency)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPrice(o.total, o.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <Link href={`/store/${slug}`} className="text-sm underline text-slate-600">
          ← Back to the catalog
        </Link>
      </div>
    </div>
  );
}
