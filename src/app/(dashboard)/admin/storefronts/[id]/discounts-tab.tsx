"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Notify } from "./store-shared";

interface DiscountsTabProps {
  storeId: string;
  volumeDiscountsEnabled: boolean;
  notify: Notify;
}

export default function DiscountsTab({ storeId, volumeDiscountsEnabled, notify }: DiscountsTabProps) {
  const [tiers, setTiers] = useState<{ id: string; min_seats: number; discount_percent: number; is_active: boolean }[]>([]);
  const [newTier, setNewTier] = useState({ min_seats: "", discount_percent: "" });

  const loadTiers = useCallback(async () => {
    const res = await fetch(`/api/storefront/admin/${storeId}/volume-tiers`);
    if (res.ok) setTiers((await res.json()).tiers || []);
  }, [storeId]);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

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

  return (
    <div className="max-w-2xl">
      <h2 className="font-semibold text-lg">Volume (bulk seat) discounts</h2>
      <p className="mt-1 text-sm text-gray-600">
        Reward clients who book more seats. A course line gets the best tier it qualifies for.
        {volumeDiscountsEnabled
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
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
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
  );
}
