"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_purchase: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

type CouponStatus = "Inactive" | "Expired" | "Exhausted" | "Active";

function couponStatus(coupon: Coupon): CouponStatus {
  if (!coupon.is_active) return "Inactive";
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return "Expired";
  if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) return "Exhausted";
  return "Active";
}

const statusBadge: Record<CouponStatus, string> = {
  Inactive: "text-gray-500 bg-gray-100",
  Expired: "text-red-600 bg-red-50",
  Exhausted: "text-yellow-600 bg-yellow-50",
  Active: "text-green-600 bg-green-50",
};

export default function CouponsAdminClient() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
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
            <Link href="/admin/ecommerce" className="hover:text-primary-600">eCommerce</Link>
            <span>/</span>
            <span className="text-gray-900">Coupons</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-500 mt-1">Create and manage discount coupons</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create Coupon</Button>
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
                  className="rounded border-gray-300 text-primary-600"
                />
                Active
              </label>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={creating}>
                  Create Coupon
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coupons Table */}
      <DataTable
        columns={columns}
        rows={coupons}
        rowKey={(coupon) => coupon.id}
        ariaLabel="Coupons"
        emptyState={{
          icon: <Ticket className="h-10 w-10" aria-hidden="true" />,
          title: "No coupons yet",
          description: "Create your first discount coupon",
          action: <Button onClick={() => setShowCreate(true)}>Create Coupon</Button>,
        }}
      />
    </div>
  );
}

const columns: DataTableColumn<Coupon>[] = [
  {
    key: "code",
    header: "Code",
    sortValue: (c) => c.code,
    render: (coupon) => (
      <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
        {coupon.code}
      </span>
    ),
  },
  {
    key: "discount",
    header: "Discount",
    sortValue: (c) => c.discount_value,
    render: (coupon) => (
      <span className="text-sm text-gray-700">
        {coupon.discount_type === "percentage"
          ? `${coupon.discount_value}%`
          : formatPrice(coupon.discount_value)}
        {coupon.min_purchase && (
          <span className="text-xs text-gray-500 block">
            Min: {formatPrice(coupon.min_purchase)}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "usage",
    header: "Usage",
    sortValue: (c) => c.current_uses,
    render: (coupon) => (
      <span className="text-sm text-gray-700">
        {coupon.current_uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
      </span>
    ),
  },
  {
    key: "validPeriod",
    header: "Valid Period",
    sortValue: (c) => c.valid_until,
    render: (coupon) => (
      <span className="text-xs text-gray-500">
        {coupon.valid_from ? new Date(coupon.valid_from).toLocaleDateString() : "No start"}
        {" - "}
        {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : "No end"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (c) => couponStatus(c),
    render: (coupon) => {
      const status = couponStatus(coupon);
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[status]}`}>
          {status}
        </span>
      );
    },
  },
];
