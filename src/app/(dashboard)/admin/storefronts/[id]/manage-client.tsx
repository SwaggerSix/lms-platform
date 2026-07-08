"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import type { Order, Product, Storefront } from "./store-shared";
import ProductsTab from "./products-tab";
import OrdersTab from "./orders-tab";
import ReportsTab from "./reports-tab";
import DiscountsTab from "./discounts-tab";
import ImportTab from "./import-tab";
import SettingsTab from "./settings-tab";
import PublishTab from "./publish-tab";

type Tab = "products" | "orders" | "import" | "settings" | "discounts" | "reports" | "publish";

export default function ManageStoreClient({ storeId }: { storeId: string }) {
  const [store, setStore] = useState<Storefront | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>("products");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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
      setStore((data.storefronts || []).find((x: Storefront) => x.id === storeId) || null);
    }
    if (productsRes.ok) setProducts((await productsRes.json()).products || []);
    if (ordersRes.ok) setOrders((await ordersRes.json()).orders || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="p-6 text-gray-500">Loading store…</div>;
  if (!store) return <div className="p-6 text-gray-500">Store not found.</div>;

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
            aria-pressed={tab === t.key}
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
        <ProductsTab storeId={storeId} products={products} notify={notify} onReload={load} />
      )}
      {tab === "orders" && (
        <OrdersTab storeId={storeId} orders={orders} notify={notify} onReload={load} />
      )}
      {tab === "reports" && <ReportsTab storeId={storeId} />}
      {tab === "discounts" && (
        <DiscountsTab
          storeId={storeId}
          volumeDiscountsEnabled={Boolean(store.volume_discounts_enabled)}
          notify={notify}
        />
      )}
      {tab === "import" && <ImportTab storeId={storeId} onReload={load} />}
      {tab === "settings" && (
        <SettingsTab storeId={storeId} store={store} notify={notify} onReload={load} />
      )}
      {tab === "publish" && <PublishTab store={store} />}
    </div>
  );
}
