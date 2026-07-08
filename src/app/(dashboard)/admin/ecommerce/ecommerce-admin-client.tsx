"use client";

import { useState } from "react";
import Link from "next/link";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

const statusStyles: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-red-100 text-red-700",
  failed: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  coming_soon: "bg-blue-100 text-blue-700",
};

interface EcommerceAdminClientProps {
  initialOrders: any[];
  initialProducts: any[];
  initialCourses: any[];
}

export default function EcommerceAdminClient({ initialOrders, initialProducts, initialCourses }: EcommerceAdminClientProps) {
  const [orders] = useState<any[]>(initialOrders);
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [courses] = useState<any[]>(initialCourses);

  // Product form
  const [newProduct, setNewProduct] = useState({
    course_id: "",
    price: "",
    discount_price: "",
    is_featured: false,
    status: "active",
    name: "",
    description: "",
    image_url: "",
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Revenue stats
  const totalRevenue = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const totalProducts = products.length;
  const avgOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: newProduct.course_id,
          price: parseFloat(newProduct.price),
          discount_price: newProduct.discount_price ? parseFloat(newProduct.discount_price) : null,
          is_featured: newProduct.is_featured,
          status: newProduct.status,
          name: newProduct.name.trim() || null,
          description: newProduct.description.trim() || null,
          image_url: newProduct.image_url || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create product");
      } else {
        setProducts((prev) => [data, ...prev]);
        setShowCreateProduct(false);
        setNewProduct({ course_id: "", price: "", discount_price: "", is_featured: false, status: "active", name: "", description: "", image_url: "" });
      }
    } catch {
      setCreateError("An error occurred");
    } finally {
      setCreating(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCreateError("");
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "branding");
      fd.append("folder", "products");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to upload image");
      } else {
        setNewProduct((p) => ({ ...p, image_url: data.url }));
      }
    } catch {
      setCreateError("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">eCommerce Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage products, orders, and revenue</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/ecommerce/coupons"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Manage Coupons
          </Link>
          <button
            onClick={() => setShowCreateProduct(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Completed Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{completedOrders}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Products</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalProducts}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Avg Order Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(avgOrderValue)}</p>
        </div>
      </div>

      {/* Create Product Modal */}
      {showCreateProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Product</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  value={newProduct.course_id}
                  onChange={(e) => setNewProduct({ ...newProduct, course_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select a course</option>
                  {courses.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              {/* Optional shop display overrides */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name <span className="font-normal text-gray-400">(optional — defaults to course title)</span>
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Shown in the shop instead of the course title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="font-normal text-gray-400">(optional — defaults to course description)</span>
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  rows={3}
                  placeholder="Marketing copy shown on the shop listing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Image <span className="font-normal text-gray-400">(optional — defaults to course thumbnail)</span>
                </label>
                {newProduct.image_url ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newProduct.image_url} alt="Product preview" className="h-16 w-24 rounded-lg object-cover border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setNewProduct({ ...newProduct, image_url: "" })}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-primary-400 hover:bg-primary-50/50">
                    {uploadingImage ? "Uploading..." : "Upload an image (PNG, JPG, WebP — max 5MB)"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Price (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProduct.discount_price}
                  onChange={(e) => setNewProduct({ ...newProduct, discount_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newProduct.status}
                  onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="coming_soon">Coming Soon</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newProduct.is_featured}
                  onChange={(e) => setNewProduct({ ...newProduct, is_featured: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                Featured product
              </label>
              {createError && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateProduct(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No orders yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.slice(0, 8).map((order) => (
                <div key={order.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[order.status]}`}>
                      {order.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{formatPrice(order.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Products</h2>
          </div>
          {products.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No products yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {products.slice(0, 8).map((product) => (
                <div key={product.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.name || product.course?.title || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500">{product.sales_count} sales</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[product.status]}`}>
                      {product.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{formatPrice(product.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
