"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FEATURE_CATEGORIES,
  type FeatureDefinition,
} from "@/lib/features/catalog";

interface FeatureTogglesProps {
  tenantId: string;
}

export function FeatureToggles({ tenantId }: FeatureTogglesProps) {
  const [catalog, setCatalog] = useState<FeatureDefinition[]>([]);
  const [effective, setEffective] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/tenants/${tenantId}/features`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!active) return;
        setCatalog(data.catalog || []);
        setEffective(data.effective || {});
      } catch (err) {
        if (active)
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Failed to load features",
          });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tenantId]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const isOn = (key: string) =>
    key in dirty ? dirty[key] : effective[key] ?? true;

  const toggle = (key: string) => {
    setDirty((prev) => ({ ...prev, [key]: !isOn(key) }));
  };

  const hasChanges = Object.keys(dirty).length > 0;

  const grouped = useMemo(() => {
    const byCategory = new Map<string, FeatureDefinition[]>();
    for (const f of catalog) {
      const list = byCategory.get(f.category) || [];
      list.push(f);
      byCategory.set(f.category, list);
    }
    return FEATURE_CATEGORIES.map((category) => ({
      category,
      items: byCategory.get(category) || [],
    })).filter((g) => g.items.length > 0);
  }, [catalog]);

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: dirty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEffective(data.effective || {});
      setDirty({});
      showMessage("success", "Features updated");
    } catch (err) {
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to save features"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading features…</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Features</h3>
        <p className="text-sm text-gray-500 mt-1">
          Turn functionality on or off for this tenant. Disabled features are
          hidden from the tenant&apos;s users and blocked server-side.
        </p>
      </div>

      {message && (
        <div
          className={cn(
            "px-4 py-3 rounded-lg text-sm border",
            message.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          )}
        >
          {message.text}
        </div>
      )}

      {grouped.map((group) => (
        <div
          key={group.category}
          className="bg-white border border-gray-200 rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {group.category}
            </h4>
          </div>
          <div className="divide-y divide-gray-100">
            {group.items.map((feature) => {
              const on = isOn(feature.key);
              return (
                <div
                  key={feature.key}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="pr-4">
                    <p className="text-sm font-medium text-gray-900">
                      {feature.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {feature.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`Toggle ${feature.name}`}
                    onClick={() => toggle(feature.key)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
                      on ? "bg-indigo-600" : "bg-gray-300"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                        on ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
