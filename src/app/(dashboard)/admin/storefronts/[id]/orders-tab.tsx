"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, type Notify, type Order } from "./store-shared";

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  "all",
  "pending",
  "completed",
  "cancelled",
  "refunded",
  "partially_refunded",
  "failed",
];

interface OrdersTabProps {
  storeId: string;
  orders: Order[];
  /** Total matching orders across all pages (server count). */
  total: number;
  page: number;
  status: string;
  onPageChange: (page: number) => void;
  onStatusChange: (status: string) => void;
  notify: Notify;
  onReload: () => Promise<void>;
}

export default function OrdersTab({
  storeId,
  orders,
  total,
  page,
  status,
  onPageChange,
  onStatusChange,
  notify,
  onReload,
}: OrdersTabProps) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function updateOrder(
    orderId: string,
    patch: { status?: string; admin_notes?: string | null; refund_amount?: number }
  ) {
    setOrderBusy(orderId);
    try {
      const res = await fetch(`/api/storefront/admin/${storeId}/orders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error || "Could not update the order");
        return;
      }
      notify("ok", "Order updated");
      await onReload();
    } finally {
      setOrderBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Status filter */}
      <div className="flex items-center justify-between gap-3">
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label="Filter orders by status"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s.replace("_", " ")}
            </option>
          ))}
        </select>
        {total > 0 && (
          <p className="text-sm text-gray-500">
            {total} order{total === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {orders.length === 0 && (
        <div className="text-gray-500 py-12 text-center">
          {status === "all" ? "No orders yet." : "No orders with this status."}
        </div>
      )}

      {orders.map((o) => {
        const open = expandedOrder === o.id;
        const refundable = Number(o.total) - Number(o.refunded_amount || 0);
        return (
          <div key={o.id} className="rounded-xl border border-gray-200">
            <button
              onClick={() => setExpandedOrder(open ? null : o.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs text-gray-500">{o.order_number}</div>
                <div className="font-medium truncate">{o.company_name || o.customer_name || o.customer_email}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-medium">{money(Number(o.total), o.currency || "USD")}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    o.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : o.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : o.status === "cancelled"
                          ? "bg-gray-200 text-gray-700"
                          : o.status === "partially_refunded"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-red-100 text-red-700"
                  }`}
                >
                  {o.status.replace("_", " ")}
                </span>
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  {new Date(o.created_at).toLocaleDateString()}
                </span>
              </div>
            </button>

            {open && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-4 text-sm">
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                  <div><span className="text-gray-500">Contact:</span> {o.customer_name || "—"}</div>
                  <div><span className="text-gray-500">Email:</span> {o.customer_email || "—"}</div>
                  {o.customer_phone && <div><span className="text-gray-500">Phone:</span> {o.customer_phone}</div>}
                  {o.po_number && <div><span className="text-gray-500">PO:</span> {o.po_number}</div>}
                  {o.payment_method && <div><span className="text-gray-500">Payment:</span> {o.payment_method}</div>}
                  {Number(o.refunded_amount) > 0 && (
                    <div><span className="text-gray-500">Refunded:</span> {money(Number(o.refunded_amount), o.currency || "USD")}</div>
                  )}
                </div>

                <div className="rounded-lg border border-gray-100 divide-y divide-gray-100">
                  {o.items.map((i) => (
                    <div key={i.id} className="flex justify-between px-3 py-2">
                      <span>{i.product_name || i.product?.name || "Course"} <span className="text-gray-500">× {i.quantity} {i.quantity === 1 ? "seat" : "seats"}</span></span>
                      <span className="text-gray-600">{money(Number(i.price) * i.quantity, o.currency || "USD")}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 text-gray-500">
                    <span>Subtotal</span><span>{money(Number(o.subtotal ?? o.total), o.currency || "USD")}</span>
                  </div>
                  {Number(o.discount_amount) > 0 && (
                    <div className="flex justify-between px-3 py-2 text-gray-500"><span>Discount</span><span>-{money(Number(o.discount_amount), o.currency || "USD")}</span></div>
                  )}
                  {Number(o.tax_amount) > 0 && (
                    <div className="flex justify-between px-3 py-2 text-gray-500"><span>Tax</span><span>{money(Number(o.tax_amount), o.currency || "USD")}</span></div>
                  )}
                </div>

                {o.order_notes && (
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-blue-900">
                    <span className="font-medium">Client notes:</span> {o.order_notes}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-gray-500">Status</label>
                  <select
                    defaultValue={o.status}
                    disabled={orderBusy === o.id}
                    onChange={(e) => updateOrder(o.id, { status: e.target.value })}
                    className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
                  >
                    {["pending", "completed", "cancelled", "refunded", "partially_refunded", "failed"].map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                  {refundable > 0.001 && (
                    <Button
                      variant="outline-destructive"
                      size="sm"
                      disabled={orderBusy === o.id}
                      onClick={() => {
                        const input = prompt(`Refund amount (max ${refundable.toFixed(2)}):`, refundable.toFixed(2));
                        if (input == null) return;
                        const amt = parseFloat(input);
                        if (!isFinite(amt) || amt <= 0) return;
                        updateOrder(o.id, { refund_amount: amt });
                      }}
                    >
                      Refund
                    </Button>
                  )}
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Internal notes</label>
                  <textarea
                    defaultValue={o.admin_notes || ""}
                    rows={2}
                    onBlur={(e) => {
                      if (e.target.value !== (o.admin_notes || "")) {
                        updateOrder(o.id, { admin_notes: e.target.value || null });
                      }
                    }}
                    placeholder="Notes for your team (not shown to the client)…"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Pager (the orders API serves 25/page) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
