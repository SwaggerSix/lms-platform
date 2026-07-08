"use client";

import { useEffect, useState } from "react";
import { type Notify, type Storefront } from "./store-shared";

interface SettingsTabProps {
  storeId: string;
  store: Storefront;
  notify: Notify;
  onReload: () => Promise<void>;
}

function settingsFromStore(s: Storefront): Record<string, string | boolean> {
  return {
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
  };
}

export default function SettingsTab({ storeId, store, notify, onReload }: SettingsTabProps) {
  const [settings, setSettings] = useState<Record<string, string | boolean>>(() => settingsFromStore(store));
  const [saving, setSaving] = useState(false);

  // Re-sync from the server copy whenever it refreshes (mirrors the old
  // behavior where every reload repopulated the settings form).
  useEffect(() => {
    setSettings(settingsFromStore(store));
  }, [store]);

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
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  return (
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
        className="px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
