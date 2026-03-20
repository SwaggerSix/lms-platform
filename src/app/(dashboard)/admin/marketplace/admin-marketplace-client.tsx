"use client";

import { useState } from "react";
import ProviderSetup from "@/components/marketplace/provider-setup";

interface Provider {
  id: string;
  name: string;
  provider_type: string;
  is_active: boolean;
  catalog_synced_at: string | null;
  course_count: number;
  created_at: string;
}

interface Props {
  initialProviders: Provider[];
  stats: {
    totalProviders: number;
    activeProviders: number;
    totalCourses: number;
    totalEnrollments: number;
  };
}

const providerLabels: Record<string, string> = {
  linkedin_learning: "LinkedIn Learning",
  coursera: "Coursera",
  udemy_business: "Udemy Business",
  openai: "OpenAI",
  custom: "Custom",
};

const providerColors: Record<string, string> = {
  linkedin_learning: "bg-blue-100 text-blue-800",
  coursera: "bg-indigo-100 text-indigo-800",
  udemy_business: "bg-purple-100 text-purple-800",
  openai: "bg-gray-100 text-gray-800",
  custom: "bg-gray-100 text-gray-600",
};

export default function AdminMarketplaceClient({ initialProviders, stats }: Props) {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [showSetup, setShowSetup] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleProviderCreated = (provider: Provider) => {
    setProviders((prev) => [{ ...provider, course_count: 0 }, ...prev]);
    setShowSetup(false);
  };

  const handleSync = async (providerId: string) => {
    setSyncing(providerId);
    try {
      const res = await fetch(`/api/marketplace/providers/${providerId}/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Sync failed");
        return;
      }
      alert(`Sync complete. Imported ${data.imported} courses.${data.errors.length > 0 ? ` Errors: ${data.errors.join(", ")}` : ""}`);
      // Refresh provider data
      const provRes = await fetch(`/api/marketplace/providers/${providerId}`);
      if (provRes.ok) {
        const provData = await provRes.json();
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? { ...p, catalog_synced_at: provData.catalog_synced_at, course_count: provData.stats?.total_courses || p.course_count }
              : p
          )
        );
      }
    } catch (err) {
      alert("Sync failed. Check the console for details.");
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleActive = async (providerId: string, currentState: boolean) => {
    const res = await fetch(`/api/marketplace/providers/${providerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !currentState }),
    });
    if (res.ok) {
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, is_active: !currentState } : p))
      );
    }
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm("Delete this provider and all its synced courses?")) return;
    const res = await fetch(`/api/marketplace/providers/${providerId}`, { method: "DELETE" });
    if (res.ok) {
      setProviders((prev) => prev.filter((p) => p.id !== providerId));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Marketplace</h1>
          <p className="text-gray-500 mt-1">Integrate and manage third-party content providers</p>
        </div>
        <button
          onClick={() => setShowSetup(true)}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Add Provider
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Providers", value: stats.totalProviders, sub: `${stats.activeProviders} active` },
          { label: "External Courses", value: stats.totalCourses },
          { label: "Enrollments", value: stats.totalEnrollments },
          { label: "Completion Rate", value: "N/A", sub: "Coming soon" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            {s.sub && <p className="text-xs text-gray-400">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Setup Wizard */}
      {showSetup && (
        <div className="mb-6">
          <ProviderSetup
            onSuccess={handleProviderCreated}
            onCancel={() => setShowSetup(false)}
          />
        </div>
      )}

      {/* Providers List */}
      <div className="space-y-4">
        {providers.length === 0 && !showSetup ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="text-4xl mb-3">🔌</div>
            <h3 className="text-lg font-semibold text-gray-700">No providers configured</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Connect your first content provider to start importing courses.
            </p>
            <button
              onClick={() => setShowSetup(true)}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Add Provider
            </button>
          </div>
        ) : (
          providers.map((provider) => (
            <div key={provider.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${providerColors[provider.provider_type] || "bg-gray-100"}`}>
                    {provider.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${providerColors[provider.provider_type]}`}>
                        {providerLabels[provider.provider_type] || provider.provider_type}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${provider.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {provider.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{provider.course_count}</p>
                    <p className="text-xs text-gray-500">courses</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {provider.catalog_synced_at
                        ? `Synced ${new Date(provider.catalog_synced_at).toLocaleDateString()}`
                        : "Never synced"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSync(provider.id)}
                      disabled={syncing === provider.id}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                    >
                      {syncing === provider.id ? "Syncing..." : "Sync"}
                    </button>
                    <button
                      onClick={() => handleToggleActive(provider.id, provider.is_active)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        provider.is_active
                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {provider.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(provider.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
