"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function CouponsAdminClient() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    max_uses: "",
    min_purchase: "",
    valid_from: "",
    valid_until: "",
    is_active: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/shop/coupons");
        if (res.ok) {
          const data = await res.json();
          setCoupons(data.coupons || []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/shop/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          discount_type: form.discount_type,
          discount_value: parseFloat(form.discount_value),
          max_uses: form.max_uses ? parseInt(form.max_uses) : null,
          min_purchase: form.min_purchase ? parseFloat(form.min_purchase) : null,
          valid_from: form.valid_from || null,
          valid_until: form.valid_until || null,
          is_active: form.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create coupon");
      } else {
        setCoupons((prev) => [data, ...prev]);
        setShowCreate(false);
        setForm({
          code: "",
          discount_type: "percentage",
          discount_value: "",
          max_uses: "",
          min_purchase: "",
          valid_from: "",
          valid_until: "",
          is_active: true,
        });
      }
    } catch {
      setError("An error occurred");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin/ecommerce" className="hover:text-indigo-600">eCommerce</Link>
            <span>/</span>
            <span className="text-gray-900">Coupons</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Coupon Management</h1>
          <p className="text-gray-500 mt-1">Create and manage discount coupons</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Create Coupon
        </button>
      </div>

      {/* Create Coupon Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Coupon</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                  placeholder="e.g. SAVE20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percentage" | "fixed" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Value {form.discount_type === "percentage" ? "(%)" : "($)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses (optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Purchase ($, optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.min_purchase}
                    onChange={(e) => setForm({ ...form, min_purchase: e.target.value })}
                    placeholder="No minimum"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600"
                />
                Active
              </label>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coupons Table */}
      {coupons.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No coupons yet</h3>
          <p className="text-gray-500">Create your first discount coupon</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Code</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Discount</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Usage</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Valid Period</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map((coupon) => {
                  const now = new Date();
                  const isExpired = coupon.valid_until && new Date(coupon.valid_until) < now;
                  const isExhausted = coupon.max_uses && coupon.current_uses >= coupon.max_uses;

                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {coupon.discount_type === "percentage"
                          ? `${coupon.discount_value}%`
                          : formatPrice(coupon.discount_value)}
                        {coupon.min_purchase && (
                          <span className="text-xs text-gray-400 block">
                            Min: {formatPrice(coupon.min_purchase)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {coupon.current_uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {coupon.valid_from
                          ? new Date(coupon.valid_from).toLocaleDateString()
                          : "No start"}
                        {" - "}
                        {coupon.valid_until
                          ? new Date(coupon.valid_until).toLocaleDateString()
                          : "No end"}
                      </td>
                      <td className="px-5 py-3">
                        {!coupon.is_active ? (
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
                        ) : isExpired ? (
                          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Expired</span>
                        ) : isExhausted ? (
                          <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Exhausted</span>
                        ) : (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
