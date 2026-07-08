"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { money, type Notify, type Product } from "./store-shared";

const emptyProductForm = {
  name: "",
  description: "",
  price: "",
  discount_price: "",
  category: "",
  duration_label: "",
  min_participants: "1",
  max_participants: "",
  image_url: "",
  is_featured: false,
  status: "active",
  listed_in_storefront: true,
  nasba_certified: false,
  nasba_cpe_credits: "",
  nasba_field_of_study: "",
  nasba_knowledge_level: "",
  nasba_prerequisites: "",
  nasba_advance_prep: "",
  nasba_delivery_method: "",
};
const NASBA_LEVELS = ["Basic", "Overview", "Intermediate", "Advanced", "Update"];

interface ProductsTabProps {
  storeId: string;
  products: Product[];
  notify: Notify;
  onReload: () => Promise<void>;
}

export default function ProductsTab({ storeId, products, notify, onReload }: ProductsTabProps) {
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ ...emptyProductForm });
  const [saving, setSaving] = useState(false);

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...(editingId && { product_id: editingId }),
        name: productForm.name,
        description: productForm.description || null,
        price: parseFloat(productForm.price),
        discount_price: productForm.discount_price ? parseFloat(productForm.discount_price) : null,
        category: productForm.category || null,
        duration_label: productForm.duration_label || null,
        min_participants: productForm.min_participants ? parseInt(productForm.min_participants) : 1,
        max_participants: productForm.max_participants ? parseInt(productForm.max_participants) : null,
        image_url: productForm.image_url || "",
        is_featured: productForm.is_featured,
        status: productForm.status,
        listed_in_storefront: productForm.listed_in_storefront,
        nasba_certified: productForm.nasba_certified,
        nasba_cpe_credits: productForm.nasba_cpe_credits ? Number(productForm.nasba_cpe_credits) : null,
        nasba_field_of_study: productForm.nasba_field_of_study || null,
        nasba_knowledge_level: productForm.nasba_knowledge_level || null,
        nasba_prerequisites: productForm.nasba_prerequisites || null,
        nasba_advance_prep: productForm.nasba_advance_prep || null,
        nasba_delivery_method: productForm.nasba_delivery_method || null,
      };
      const res = await fetch(`/api/storefront/admin/${storeId}/products`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error || "Could not save the product");
        return;
      }
      setShowProductForm(false);
      setEditingId(null);
      setProductForm({ ...emptyProductForm });
      notify("ok", editingId ? "Product updated" : "Product added");
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`Remove "${p.name}" from the store?`)) return;
    const res = await fetch(
      `/api/storefront/admin/${storeId}/products?product_id=${p.id}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      notify("err", data.error || "Could not remove the product");
      return;
    }
    notify("ok", data.archived ? "Product hidden (it has past orders, so it was archived)" : "Product removed");
    await onReload();
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setProductForm({
      name: p.name || "",
      description: p.description || "",
      price: String(p.price),
      discount_price: p.discount_price != null ? String(p.discount_price) : "",
      category: p.category || "",
      duration_label: p.duration_label || "",
      min_participants: p.min_participants != null ? String(p.min_participants) : "1",
      max_participants: p.max_participants != null ? String(p.max_participants) : "",
      image_url: p.image_url || "",
      is_featured: p.is_featured,
      status: p.status,
      listed_in_storefront: p.listed_in_storefront ?? true,
      nasba_certified: (p as any).nasba_certified ?? false,
      nasba_cpe_credits: (p as any).nasba_cpe_credits != null ? String((p as any).nasba_cpe_credits) : "",
      nasba_field_of_study: (p as any).nasba_field_of_study ?? "",
      nasba_knowledge_level: (p as any).nasba_knowledge_level ?? "",
      nasba_prerequisites: (p as any).nasba_prerequisites ?? "",
      nasba_advance_prep: (p as any).nasba_advance_prep ?? "",
      nasba_delivery_method: (p as any).nasba_delivery_method ?? "",
    });
    setShowProductForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setEditingId(null);
            setProductForm({ ...emptyProductForm });
            setShowProductForm((s) => !s);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {showProductForm && (
        <form onSubmit={saveProduct} className="mb-6 rounded-xl border border-gray-200 p-5 bg-gray-50 space-y-3">
          <div className="font-semibold">{editingId ? "Edit product" : "New product"}</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                required
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                rows={3}
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Price ($)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sale price ($, optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={productForm.discount_price}
                onChange={(e) => setProductForm({ ...productForm, discount_price: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input
                list={`categories-${storeId}`}
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="e.g. Communication"
              />
              <datalist id={`categories-${storeId}`}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Image web address (optional)</label>
              <input
                type="url"
                value={productForm.image_url}
                onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duration label (optional)</label>
              <input
                value={productForm.duration_label}
                onChange={(e) => setProductForm({ ...productForm, duration_label: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="e.g. 2 days, 90 minutes"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Min seats</label>
                <input
                  type="number"
                  min="1"
                  value={productForm.min_participants}
                  onChange={(e) => setProductForm({ ...productForm, min_participants: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max seats (blank = no cap)</label>
                <input
                  type="number"
                  min="1"
                  value={productForm.max_participants}
                  onChange={(e) => setProductForm({ ...productForm, max_participants: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  placeholder="e.g. 25"
                />
              </div>
            </div>
            <div className="flex items-center gap-5 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productForm.is_featured}
                  onChange={(e) => setProductForm({ ...productForm, is_featured: e.target.checked })}
                />
                Featured (shown at the top of the store)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productForm.listed_in_storefront}
                  onChange={(e) => setProductForm({ ...productForm, listed_in_storefront: e.target.checked })}
                />
                Offer in the online store
              </label>
              <label className="flex items-center gap-2 text-sm">
                Visibility
                <select
                  value={productForm.status}
                  onChange={(e) => setProductForm({ ...productForm, status: e.target.value })}
                  className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
                >
                  <option value="active">Visible in store</option>
                  <option value="inactive">Hidden</option>
                  <option value="coming_soon">Coming soon</option>
                </select>
              </label>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-gray-200 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={productForm.nasba_certified}
                  onChange={(e) => setProductForm({ ...productForm, nasba_certified: e.target.checked })}
                />
                NASBA CPE certified
              </label>
              {productForm.nasba_certified && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input value={productForm.nasba_cpe_credits} onChange={(e) => setProductForm({ ...productForm, nasba_cpe_credits: e.target.value })} type="number" min={0} step="0.5" placeholder="CPE credits" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <input value={productForm.nasba_field_of_study} onChange={(e) => setProductForm({ ...productForm, nasba_field_of_study: e.target.value })} placeholder="Field of study (NASBA domain)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <select value={productForm.nasba_knowledge_level} onChange={(e) => setProductForm({ ...productForm, nasba_knowledge_level: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="">Knowledge level…</option>
                    {NASBA_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <input value={productForm.nasba_delivery_method} onChange={(e) => setProductForm({ ...productForm, nasba_delivery_method: e.target.value })} placeholder="Delivery method" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <input value={productForm.nasba_prerequisites} onChange={(e) => setProductForm({ ...productForm, nasba_prerequisites: e.target.value })} placeholder="Prerequisites" className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2" />
                  <input value={productForm.nasba_advance_prep} onChange={(e) => setProductForm({ ...productForm, nasba_advance_prep: e.target.value })} placeholder="Advance preparation" className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2" />
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add product"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowProductForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {products.length === 0 ? (
        <div className="text-gray-500 py-12 text-center">
          No products yet. Add one above, or use “Import catalog” to bring in your existing
          store in one go.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium max-w-xs truncate">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category || "—"}</td>
                  <td className="px-4 py-3">
                    {p.discount_price != null ? (
                      <>
                        <span className="font-medium">{money(Number(p.discount_price))}</span>{" "}
                        <span className="text-gray-400 line-through">{money(Number(p.price))}</span>
                      </>
                    ) : (
                      money(Number(p.price))
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        p.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : p.status === "coming_soon"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status === "active" ? "Visible" : p.status === "coming_soon" ? "Coming soon" : "Hidden"}
                    </span>
                    {p.is_featured && (
                      <span className="ml-1 text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                        Featured
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.sales_count}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 text-gray-400 hover:text-primary-600"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(p)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
