"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Store } from "lucide-react";

interface Storefront {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  is_active: boolean;
}

interface StoreStats {
  products: number;
  orders: number;
  revenue: number;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function StorefrontsClient() {
  const [stores, setStores] = useState<Storefront[]>([]);
  const [stats, setStats] = useState<Record<string, StoreStats>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", tagline: "" });

  async function load() {
    try {
      const res = await fetch("/api/storefront/admin");
      if (res.ok) {
        const data = await res.json();
        setStores(data.storefronts || []);
        setStats(data.stats || {});
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createStore(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/storefront/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          tagline: form.tagline || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create the store");
        return;
      }
      setShowCreate(false);
      setForm({ name: "", slug: "", tagline: "" });
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Storefronts</h1>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New store
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Your public online shops. Each store has its own web address, branding, catalog, and
        orders — customers can buy without creating an account.
      </p>

      {showCreate && (
        <form onSubmit={createStore} className="mb-8 rounded-xl border border-gray-200 p-5 bg-gray-50 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Store name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="e.g. gothamCulture Training"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Web address (letters, numbers, dashes)
              </label>
              <input
                required
                value={form.slug}
                onChange={(e) =>
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                placeholder="e.g. gothamculture"
              />
              {form.slug && (
                <p className="mt-1 text-xs text-gray-500">Store will live at /store/{form.slug}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tagline (optional)</label>
            <input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              placeholder="A short line shown at the top of the store"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create store"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Loading stores…</div>
      ) : stores.length === 0 ? (
        <div className="text-gray-500 py-12 text-center">
          <Store className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          No stores yet. Create your first one above.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {stores.map((s) => {
            const st = stats[s.id] || { products: 0, orders: 0, revenue: 0 };
            return (
              <div key={s.id} className="rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-lg truncate">{s.name}</div>
                    <div className="text-sm text-gray-500 truncate">
                      {s.tagline || `/store/${s.slug}`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
                      s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.is_active ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 py-2">
                    <div className="text-lg font-bold">{st.products}</div>
                    <div className="text-xs text-gray-500">Products</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 py-2">
                    <div className="text-lg font-bold">{st.orders}</div>
                    <div className="text-xs text-gray-500">Orders</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 py-2">
                    <div className="text-lg font-bold">{money(st.revenue)}</div>
                    <div className="text-xs text-gray-500">Revenue</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/admin/storefronts/${s.id}`}
                    className="flex-1 text-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                  >
                    Manage
                  </Link>
                  <a
                    href={`/store/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View store
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
