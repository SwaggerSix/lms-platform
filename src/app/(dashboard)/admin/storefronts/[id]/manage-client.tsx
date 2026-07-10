"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  // The orders API pages server-side (25/page); the UI tracks the current
  // page and status filter and re-fetches on change.
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersStatus, setOrdersStatus] = useState("all");
  const [tab, setTab] = useState<Tab>("products");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const notify = (kind: "ok" | "err", text: string) => {
    setMessage({ kind, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadOrders = useCallback(
    async (page: number, status: string) => {
      const params = new URLSearchParams({ page: String(page) });
      if (status && status !== "all") params.set("status", status);
      const res = await fetch(`/api/storefront/admin/${storeId}/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setOrdersTotal(data.total || 0);
        setOrdersPage(data.page || page);
      }
    },
    [storeId]
  );

  const load = useCallback(async () => {
    const [storesRes, productsRes] = await Promise.all([
      fetch("/api/storefront/admin"),
      fetch(`/api/storefront/admin/${storeId}/products`),
      loadOrders(ordersPage, ordersStatus),
    ]);
    if (storesRes.ok) {
      const data = await storesRes.json();
      setStore((data.storefronts || []).find((x: Storefront) => x.id === storeId) || null);
    }
    if (productsRes.ok) setProducts((await productsRes.json()).products || []);
    setLoading(false);
  }, [storeId, loadOrders, ordersPage, ordersStatus]);

  useEffect(() => {
    load();
    // Full reload only when the store changes; order page/status changes
    // re-fetch just the orders via loadOrders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  if (loading) return <div className="p-6 text-gray-500">Loading store…</div>;
  if (!store) return <div className="p-6 text-gray-500">Store not found.</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "products", label: `Products (${products.length})` },
    { key: "orders", label: `Orders (${ordersTotal})` },
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
        <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
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

      <Tabs value={tab} onChange={(v) => setTab(v as Tab)} className="mb-6">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "products" && (
        <ProductsTab storeId={storeId} products={products} notify={notify} onReload={load} />
      )}
      {tab === "orders" && (
        <OrdersTab
          storeId={storeId}
          orders={orders}
          total={ordersTotal}
          page={ordersPage}
          status={ordersStatus}
          onPageChange={(p) => {
            setOrdersPage(p);
            loadOrders(p, ordersStatus);
          }}
          onStatusChange={(s) => {
            setOrdersStatus(s);
            setOrdersPage(1);
            loadOrders(1, s);
          }}
          notify={notify}
          onReload={load}
        />
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
