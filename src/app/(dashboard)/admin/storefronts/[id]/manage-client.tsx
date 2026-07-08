"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Storefront {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  branding: { primary_color?: string; accent_color?: string };
  contact_email: string | null;
  announcement: string | null;
  is_active: boolean;
  order_notify_email: string | null;
  volume_discounts_enabled: boolean;
  tax_enabled: boolean;
  tax_rate: number;
  tax_label: string | null;
  analytics_measurement_id: string | null;
}

interface Product {
  id: string;
  name: string | null;
  description: string | null;
  price: number;
  discount_price: number | null;
  category: string | null;
  duration_label: string | null;
  min_participants: number | null;
  max_participants: number | null;
  image_url: string | null;
  sku: string | null;
  status: string;
  is_featured: boolean;
  listed_in_storefront: boolean;
  sales_count: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  company_name: string | null;
  customer_phone: string | null;
  po_number: string | null;
  order_notes: string | null;
  admin_notes: string | null;
  total: number;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  refunded_amount: number | null;
  payment_method: string | null;
  payment_intent_id: string | null;
  currency: string | null;
  created_at: string;
  items: {
    id: string;
    price: number;
    quantity: number;
    product_name: string | null;
    product: { name: string | null } | null;
  }[];
}

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

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

type Tab = "products" | "orders" | "import" | "settings" | "discounts" | "reports" | "publish";

export default function ManageStoreClient({ storeId }: { storeId: string }) {
  const [store, setStore] = useState<Storefront | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>("products");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ ...emptyProductForm });
  const [saving, setSaving] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<Record<string, string | boolean>>({});

  // Orders
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);

  // Volume discount tiers
  const [tiers, setTiers] = useState<{ id: string; min_seats: number; discount_percent: number; is_active: boolean }[]>([]);
  const [newTier, setNewTier] = useState({ min_seats: "", discount_percent: "" });

  // Reports
  type Analytics = {
    grossRevenue: number;
    netRevenue: number;
    refunded: number;
    completedOrders: number;
    totalOrders: number;
    seatsSold: number;
    statusCounts: Record<string, number>;
    topCourses: { name: string; seats: number; revenue: number }[];
    dailyRevenue: { date: string; revenue: number }[];
  };
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reportDays, setReportDays] = useState(90);

  const notify = (kind: "ok" | "err", text: string) => {
    setMessage({ kind, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(async () => {
    const [storesRes, productsRes, ordersRes] = await Promise.all([
      fetch("/api/storefront/admin"),
      fetch(`/api/storefront/admin/${storeId}/products`),
      fetch(`/api/storefront/admin/${storeId}/orders`),
    ]);
    if (storesRes.ok) {
      const data = await storesRes.json();
      const s = (data.storefronts || []).find((x: Storefront) => x.id === storeId) || null;
      setStore(s);
      if (s) {
        setSettings({
          name: s.name,
          tagline: s.tagline || "",
          description: s.description || "",
          logo_url: s.logo_url || "",
          hero_image_url: s.hero_image_url || "",
          contact_email: s.contact_email || "",
          announcement: s.announcement || "",
          primary_color: s.branding?.primary_color || "#0f172a",
          accent_color: s.branding?.accent_color || "#2563eb",
          is_active: s.is_active,
          order_notify_email: s.order_notify_email || "",
          volume_discounts_enabled: Boolean(s.volume_discounts_enabled),
          tax_enabled: Boolean(s.tax_enabled),
          tax_rate_percent: String(((s.tax_rate || 0) * 100).toFixed(4)).replace(/\.?0+$/, ""),
          tax_label: s.tax_label || "Tax",
          analytics_measurement_id: s.analytics_measurement_id || "",
        });
      }
    }
    if (productsRes.ok) setProducts((await productsRes.json()).products || []);
    if (ordersRes.ok) setOrders((await ordersRes.json()).orders || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "discounts") loadTiers();
    if (tab === "reports") loadAnalytics(reportDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reportDays]);

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
      await load();
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
    await load();
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

  async function handleImport(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch(`/api/storefront/admin/${storeId}/import`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult(`Import failed: ${data.error}`);
        return;
      }
      const parts = [
        `${data.created} added`,
        `${data.updated} updated`,
        ...(data.skipped?.length ? [`${data.skipped.length} skipped`] : []),
        ...(data.errors?.length ? [`${data.errors.length} errors`] : []),
      ];
      setImportResult(`Done — ${parts.join(", ")}.`);
      await load();
    } finally {
      setImporting(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/storefront/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: storeId,
          name: settings.name,
          tagline: settings.tagline || null,
          description: settings.description || null,
          logo_url: settings.logo_url || "",
          hero_image_url: settings.hero_image_url || "",
          contact_email: settings.contact_email || "",
          announcement: settings.announcement || null,
          branding: {
            primary_color: settings.primary_color as string,
            accent_color: settings.accent_color as string,
          },
          is_active: Boolean(settings.is_active),
          order_notify_email: (settings.order_notify_email as string) || "",
          volume_discounts_enabled: Boolean(settings.volume_discounts_enabled),
          tax_enabled: Boolean(settings.tax_enabled),
          tax_rate: Math.max(0, Math.min(1, (parseFloat(settings.tax_rate_percent as string) || 0) / 100)),
          tax_label: (settings.tax_label as string) || "Tax",
          analytics_measurement_id: (settings.analytics_measurement_id as string) || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error || "Could not save settings");
        return;
      }
      notify("ok", "Settings saved");
      await load();
    } finally {
      setSaving(false);
    }
  }

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
      await load();
    } finally {
      setOrderBusy(null);
    }
  }

  async function loadTiers() {
    const res = await fetch(`/api/storefront/admin/${storeId}/volume-tiers`);
    if (res.ok) setTiers((await res.json()).tiers || []);
  }

  async function addTier(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/storefront/admin/${storeId}/volume-tiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        min_seats: parseInt(newTier.min_seats),
        discount_percent: parseFloat(newTier.discount_percent),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify("err", data.error || "Could not add the tier");
      return;
    }
    setNewTier({ min_seats: "", discount_percent: "" });
    notify("ok", "Tier added");
    loadTiers();
  }

  async function deleteTier(tierId: string) {
    await fetch(`/api/storefront/admin/${storeId}/volume-tiers?tier_id=${tierId}`, { method: "DELETE" });
    loadTiers();
  }

  async function loadAnalytics(days: number) {
    const res = await fetch(`/api/storefront/admin/${storeId}/analytics?days=${days}`);
    if (res.ok) setAnalytics(await res.json());
  }

  if (loading) return <div className="p-6 text-gray-500">Loading store…</div>;
  if (!store) return <div className="p-6 text-gray-500">Store not found.</div>;

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  const tabs: { key: Tab; label: string }[] = [
    { key: "products", label: `Products (${products.length})` },
    { key: "orders", label: `Orders (${orders.length})` },
    { key: "reports", label: "Reports" },
    { key: "discounts", label: "Volume discounts" },
    { key: "import", label: "Import catalog" },
    { key: "settings", label: "Settings" },
    { key: "publish", label: "Put it on your website" },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <Link href="/admin/storefronts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3">
        <ChevronLeft className="h-4 w-4" /> All stores
      </Link>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">{store.name}</h1>
        <a
          href={`/store/${store.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View live store
        </a>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                setEditingId(null);
                setProductForm({ ...emptyProductForm });
                setShowProductForm((s) => !s);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
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
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
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
                          className="p-1.5 text-gray-400 hover:text-blue-600"
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
      )}

      {tab === "orders" && (
        <div>
          {orders.length === 0 ? (
            <div className="text-gray-500 py-12 text-center">No orders yet.</div>
          ) : (
            <div className="space-y-3">
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
                        <span className="text-gray-400 text-xs whitespace-nowrap">
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
                              <span>{i.product_name || i.product?.name || "Course"} <span className="text-gray-400">× {i.quantity} {i.quantity === 1 ? "seat" : "seats"}</span></span>
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
            </div>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm text-gray-500">Window</label>
            <select
              value={reportDays}
              onChange={(e) => setReportDays(parseInt(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
            >
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
              <option value={365}>Last 365 days</option>
            </select>
          </div>
          {!analytics ? (
            <div className="text-gray-500 py-12 text-center">Loading…</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Net revenue", value: money(analytics.netRevenue) },
                  { label: "Orders", value: String(analytics.completedOrders) },
                  { label: "Seats sold", value: String(analytics.seatsSold) },
                  { label: "Refunded", value: money(analytics.refunded) },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs text-gray-500">{c.label}</div>
                    <div className="text-xl font-bold mt-1">{c.value}</div>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Top courses</h3>
                {analytics.topCourses.length === 0 ? (
                  <div className="text-sm text-gray-500">No sales in this window yet.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-gray-500">
                        <tr>
                          <th className="px-4 py-2 font-medium">Course</th>
                          <th className="px-4 py-2 font-medium">Seats</th>
                          <th className="px-4 py-2 font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {analytics.topCourses.map((c) => (
                          <tr key={c.name}>
                            <td className="px-4 py-2">{c.name}</td>
                            <td className="px-4 py-2">{c.seats}</td>
                            <td className="px-4 py-2">{money(c.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "discounts" && (
        <div className="max-w-2xl">
          <h2 className="font-semibold text-lg">Volume (bulk seat) discounts</h2>
          <p className="mt-1 text-sm text-gray-600">
            Reward clients who book more seats. A course line gets the best tier it qualifies for.
            {settings.volume_discounts_enabled
              ? " These are currently ON."
              : " These are currently OFF — turn them on under Settings to apply them at checkout."}
          </p>

          <form onSubmit={addTier} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Seats (minimum)</label>
              <input
                type="number"
                min="2"
                required
                value={newTier.min_seats}
                onChange={(e) => setNewTier({ ...newTier, min_seats: e.target.value })}
                className="w-32 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Discount %</label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                required
                value={newTier.discount_percent}
                onChange={(e) => setNewTier({ ...newTier, discount_percent: e.target.value })}
                className="w-32 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="e.g. 10"
              />
            </div>
            <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
              Add tier
            </button>
          </form>

          <div className="mt-5 space-y-2">
            {tiers.length === 0 ? (
              <div className="text-sm text-gray-500">No tiers yet.</div>
            ) : (
              tiers.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5 text-sm">
                  <span>
                    <strong>{t.discount_percent}%</strong> off when buying <strong>{t.min_seats}+</strong> seats
                  </span>
                  <button onClick={() => deleteTier(t.id)} className="text-gray-400 hover:text-red-600" aria-label="Delete tier">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "import" && (
        <div className="max-w-2xl">
          <h2 className="font-semibold text-lg">Import your existing catalog</h2>
          <p className="mt-2 text-sm text-gray-600">
            Bring your whole catalog over from your current store in one step:
          </p>
          <ol className="mt-3 text-sm text-gray-600 list-decimal list-inside space-y-1.5">
            <li>
              In your current store&apos;s admin (Ecwid: <em>Catalog → Products → Export</em>;
              Shopify: <em>Products → Export</em>), export your products as a <strong>CSV file</strong>.
            </li>
            <li>Upload that file below. Products are matched by name/SKU, so re-importing updates rather than duplicates.</li>
            <li>Review the products in the Products tab and tidy up anything that needs it.</li>
          </ol>
          <label className="mt-6 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
            <Upload className="h-7 w-7 text-gray-400" />
            <span className="text-sm font-medium">
              {importing ? "Importing…" : "Click to choose your CSV file"}
            </span>
            <span className="text-xs text-gray-500">Ecwid, Shopify, or spreadsheet exports (max 5 MB)</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
          </label>
          {importResult && (
            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 text-sm">
              {importResult}
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <form onSubmit={saveSettings} className="max-w-2xl space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Store name</label>
              <input
                required
                value={String(settings.name || "")}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Tagline (big headline on the store)</label>
              <input
                value={String(settings.tagline || "")}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                rows={3}
                value={String(settings.description || "")}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Main brand color</label>
              <input
                type="color"
                value={String(settings.primary_color || "#0f172a")}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Accent color (sale badges, banner)</label>
              <input
                type="color"
                value={String(settings.accent_color || "#2563eb")}
                onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Logo web address (optional)</label>
              <input
                type="url"
                value={String(settings.logo_url || "")}
                onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Banner image web address (optional)</label>
              <input
                type="url"
                value={String(settings.hero_image_url || "")}
                onChange={(e) => setSettings({ ...settings, hero_image_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact email (shown in footer)</label>
              <input
                type="email"
                value={String(settings.contact_email || "")}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Announcement bar (optional)</label>
              <input
                value={String(settings.announcement || "")}
                onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="e.g. Spring sale — 20% off with code SPRING20"
              />
            </div>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold text-sm mb-3">Orders, payments &amp; commerce</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">New-order notification email</label>
                <input
                  type="email"
                  value={String(settings.order_notify_email || "")}
                  onChange={(e) => setSettings({ ...settings, order_notify_email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  placeholder="Where new-order alerts go (defaults to contact email)"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Google Analytics measurement ID (optional)</label>
                <input
                  value={String(settings.analytics_measurement_id || "")}
                  onChange={(e) => setSettings({ ...settings, analytics_measurement_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(settings.volume_discounts_enabled)}
                onChange={(e) => setSettings({ ...settings, volume_discounts_enabled: e.target.checked })}
              />
              Apply volume (bulk seat) discounts at checkout (configure tiers under “Volume discounts”)
            </label>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(settings.tax_enabled)}
                onChange={(e) => setSettings({ ...settings, tax_enabled: e.target.checked })}
              />
              Charge tax on orders
            </label>
            {Boolean(settings.tax_enabled) && (
              <div className="mt-3 grid grid-cols-2 gap-3 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Tax rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={String(settings.tax_rate_percent || "")}
                    onChange={(e) => setSettings({ ...settings, tax_rate_percent: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    placeholder="e.g. 8.25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tax label</label>
                  <input
                    value={String(settings.tax_label || "Tax")}
                    onChange={(e) => setSettings({ ...settings, tax_label: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(settings.is_active)}
              onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
            />
            Store is open (uncheck to take the store offline temporarily)
          </label>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}

      {tab === "publish" && (
        <div className="max-w-2xl space-y-6 text-sm text-gray-700">
          <div>
            <h2 className="font-semibold text-lg text-gray-900">Option 1 — Link to the store (simplest)</h2>
            <p className="mt-2">
              On your website, point your “Store” menu link to this address:
            </p>
            <code className="mt-2 block rounded-lg bg-gray-100 px-4 py-3 font-mono text-xs break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/store/{store.slug}
            </code>
          </div>
          <div>
            <h2 className="font-semibold text-lg text-gray-900">Option 2 — Embed it inside your page</h2>
            <p className="mt-2">
              Paste this snippet into your website page (in WordPress, add a “Custom HTML” block)
              and the store appears inside your existing site:
            </p>
            <code className="mt-2 block rounded-lg bg-gray-100 px-4 py-3 font-mono text-xs break-all whitespace-pre-wrap">
              {`<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/store/${store.slug}" style="width:100%;min-height:1400px;border:0;" title="${store.name}"></iframe>`}
            </code>
          </div>
          <div>
            <h2 className="font-semibold text-lg text-gray-900">Option 3 — Its own web address (recommended long-term)</h2>
            <p className="mt-2">
              A subdomain like <strong>store.gothamculture.com</strong> can point directly at this
              store. That needs one DNS record added wherever your domain is managed — ask
              whoever set up your website hosting, or we can walk through it together.
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800">
            <strong>Before going live:</strong> connect Stripe so real cards can be charged. Until
            then the store runs in test mode (orders work, nothing is charged). See STORE_GUIDE.md
            in the project, or ask your developer to set STRIPE_SECRET_KEY and
            STRIPE_WEBHOOK_SECRET.
          </div>
        </div>
      )}
    </div>
  );
}
