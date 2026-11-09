"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Ticket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local";

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
  product_id: string | null;
}

interface CouponProduct {
  id: string;
  name: string;
  store: string | null;
  is_bundle: boolean;
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

type CouponForm = {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  max_uses: string;
  min_purchase: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  product_id: string;
};

const EMPTY_FORM: CouponForm = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  max_uses: "",
  min_purchase: "",
  valid_from: "",
  valid_until: "",
  is_active: true,
  product_id: "",
};

/** The form as it opens for an existing coupon (dates in the admin's local time). */
function formFromCoupon(c: Coupon): CouponForm {
  return {
    code: c.code,
    discount_type: c.discount_type,
    discount_value: String(Number(c.discount_value)),
    max_uses: c.max_uses != null ? String(c.max_uses) : "",
    min_purchase: c.min_purchase != null ? String(Number(c.min_purchase)) : "",
    valid_from: isoToLocalInput(c.valid_from),
    valid_until: isoToLocalInput(c.valid_until),
    is_active: c.is_active,
    product_id: c.product_id ?? "",
  };
}

/** The API body for every field of the form. */
function formToBody(form: CouponForm): Record<string, unknown> {
  return {
    code: form.code,
    discount_type: form.discount_type,
    discount_value: parseFloat(form.discount_value),
    max_uses: form.max_uses ? parseInt(form.max_uses) : null,
    min_purchase: form.min_purchase ? parseFloat(form.min_purchase) : null,
    // datetime-local has no zone: send it as the admin's local time.
    valid_from: localInputToIso(form.valid_from),
    valid_until: localInputToIso(form.valid_until),
    is_active: form.is_active,
    product_id: form.product_id || null,
  };
}

export default function CouponsAdminClient() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<CouponProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // The coupon being edited (null while creating a new one).
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/shop/coupons");
        if (res.ok) {
          const data = await res.json();
          setCoupons(data.coupons || []);
          setProducts(data.products || []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(coupon: Coupon) {
    setEditing(coupon);
    setForm(formFromCoupon(coupon));
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function replaceCoupon(updated: Coupon) {
    setCoupons((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      let body = formToBody(form);
      if (editing) {
        // Send only what changed, so an untouched date isn't rewritten
        // (the field shows minutes, the stored value may have seconds).
        const before = formToBody(formFromCoupon(editing));
        body = Object.fromEntries(
          Object.entries(body).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k]))
        );
        if (Object.keys(body).length === 0) {
          closeForm();
          return;
        }
      }
      const res = await fetch(editing ? `/api/shop/coupons/${editing.id}` : "/api/shop/coupons", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (editing ? "Failed to save coupon" : "Failed to create coupon"));
      } else {
        if (editing) {
          replaceCoupon(data);
          toast.success(`Coupon ${data.code} saved`);
        } else {
          setCoupons((prev) => [data, ...prev]);
        }
        closeForm();
        setForm(EMPTY_FORM);
      }
    } catch {
      setError("An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    setToggling(coupon.id);
    try {
      const res = await fetch(`/api/shop/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't change the coupon");
      } else {
        replaceCoupon(data);
        toast.success(`${data.code} is now ${data.is_active ? "active" : "inactive"}`);
      }
    } catch {
      toast.error("Couldn't change the coupon");
    } finally {
      setToggling(null);
    }
  }

  function askDelete(coupon: Coupon) {
    setDeleteError("");
    setDeleting(coupon);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/shop/coupons/${deleting.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete coupon");
      } else {
        setCoupons((prev) => prev.filter((c) => c.id !== deleting.id));
        toast.success(`Coupon ${deleting.code} deleted`);
        setDeleting(null);
      }
    } catch {
      setDeleteError("An error occurred");
    } finally {
      setDeleteBusy(false);
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
        <Button onClick={openCreate}>Create Coupon</Button>
      </div>

      {/* Create / Edit Coupon Modal */}
      {showForm && (
        <Modal
          isOpen
          onClose={closeForm}
          title={editing ? `Edit Coupon ${editing.code}` : "Create Coupon"}
          size="md"
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" form="coupon-form" loading={saving}>
                {editing ? "Save Changes" : "Create Coupon"}
              </Button>
            </>
          }
        >
            <form id="coupon-form" onSubmit={handleSubmit} className="space-y-4">
              {editing && (
                <p className="text-sm text-gray-500">
                  Used {editing.current_uses} {editing.current_uses === 1 ? "time" : "times"} so far.
                  {editing.current_uses > 0 &&
                    " Changes apply to future checkouts only; past orders keep the discount they got."}
                </p>
              )}
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
                    max={form.discount_type === "percentage" ? 100 : undefined}
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="coupon-product" className="block text-sm font-medium text-gray-700 mb-1">
                  Only for product (optional)
                </label>
                <select
                  id="coupon-product"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Any product (whole order)</option>
                  {form.product_id && !products.some((p) => p.id === form.product_id) && (
                    <option value={form.product_id}>Current product (no longer in a store)</option>
                  )}
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_bundle ? " (bundle)" : ""}
                      {p.store ? ` — ${p.store}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  The code then only works when this product is in the cart, and only discounts it.
                </p>
              </div>
              {form.discount_type === "percentage" && Number(form.discount_value) === 100 && (
                <div className="text-sm text-primary-700 bg-primary-50 rounded-lg px-3 py-2">
                  100% off makes it free: the customer checks out without paying and is enrolled
                  straight away.
                </div>
              )}
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
            </form>
        </Modal>
      )}

      {/* Coupons Table */}
      <DataTable
        columns={buildColumns(products, {
          onEdit: openEdit,
          onToggle: toggleActive,
          onDelete: askDelete,
          toggling,
        })}
        rows={coupons}
        rowKey={(coupon) => coupon.id}
        ariaLabel="Coupons"
        emptyState={{
          icon: <Ticket className="h-10 w-10" aria-hidden="true" />,
          title: "No coupons yet",
          description: "Create your first discount coupon",
          action: <Button onClick={openCreate}>Create Coupon</Button>,
        }}
      />

      {/* Delete confirmation */}
      {deleting && (
        <Modal
          isOpen
          onClose={() => setDeleting(null)}
          title="Delete coupon?"
          size="sm"
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" loading={deleteBusy} onClick={confirmDelete}>
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-700">
            Delete the coupon <span className="font-mono font-semibold">{deleting.code}</span>? This
            can&apos;t be undone. To stop a code working but keep it, switch it to Inactive instead.
          </p>
          {deleteError && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</div>
          )}
        </Modal>
      )}
    </div>
  );
}

interface RowHandlers {
  onEdit: (c: Coupon) => void;
  onToggle: (c: Coupon) => void;
  onDelete: (c: Coupon) => void;
  toggling: string | null;
}

function buildColumns(products: CouponProduct[], h: RowHandlers): DataTableColumn<Coupon>[] {
  const productName = (id: string | null) =>
    id ? products.find((p) => p.id === id)?.name ?? "One product" : "Any";
  return [
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
    key: "product",
    header: "Product",
    sortValue: (c) => productName(c.product_id),
    render: (coupon) => (
      <span className="text-sm text-gray-700">{productName(coupon.product_id)}</span>
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
  {
    key: "actions",
    header: <span className="sr-only">Actions</span>,
    className: "text-right",
    render: (coupon) => (
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={coupon.is_active}
          aria-label={`${coupon.code} active`}
          title={coupon.is_active ? "Active: click to switch off" : "Inactive: click to switch on"}
          disabled={h.toggling === coupon.id}
          onClick={() => h.onToggle(coupon)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 ${
            coupon.is_active ? "bg-primary-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              coupon.is_active ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={() => h.onEdit(coupon)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
        <button
          type="button"
          aria-label={`Delete ${coupon.code}`}
          title="Delete"
          onClick={() => h.onDelete(coupon)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    ),
  },
];
}
