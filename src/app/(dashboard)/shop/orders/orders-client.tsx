"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

const statusStyles: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-red-100 text-red-700",
  failed: "bg-gray-100 text-gray-600",
};

export default function OrdersClient() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        const res = await fetch(`/api/shop/orders?page=${page}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          setTotalPages(data.totalPages || 1);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [page]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-20 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 mt-1">View your purchase history</p>
        </div>
        <Link href="/shop" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
          Browse Marketplace
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No orders yet</h3>
          <p className="text-gray-500 mb-4">Purchase your first course from the marketplace</p>
          <Link
            href="/shop"
            className="inline-flex px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{order.order_number}</h3>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusStyles[order.status] || "bg-gray-100"}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{formatPrice(order.total)}</div>
                  {order.discount_amount > 0 && (
                    <div className="text-xs text-green-600">Saved {formatPrice(order.discount_amount)}</div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                {(order.order_items || []).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-12 h-9 bg-gradient-to-br from-indigo-100 to-purple-100 rounded overflow-hidden shrink-0">
                      {item.product?.course?.thumbnail_url ? (
                        <img src={item.product.course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-700 flex-1 truncate">
                      {item.product?.course?.title || "Course"}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
