"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  ChevronLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Settings,
  Database,
  Users,
  RefreshCw,
  Plug,
} from "lucide-react";
import { cn } from "@/utils/cn";
import ProviderCard, { type ProviderInfo } from "@/components/integrations/provider-card";
import FieldMapper, { type FieldMappingItem } from "@/components/integrations/field-mapper";
import SyncStatus from "@/components/integrations/sync-status";

// ─── Types ───────────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  type: string;
  provider: string;
  is_active: boolean;
  config: Record<string, unknown>;
  sync_direction: string;
  sync_frequency: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  created_at: string;
}

interface HRISIntegrationsClientProps {
  initialIntegrations: Integration[];
}

type View = "list" | "add" | "configure";
type WizardStep = "provider" | "credentials" | "mappings" | "review";

const PROVIDERS = [
  { id: "bamboohr", name: "BambooHR", type: "hris", description: "Sync employee data from BambooHR", color: "border-green-200 bg-green-50 hover:bg-green-100" },
  { id: "workday", name: "Workday", type: "hris", description: "Import workforce data from Workday HCM", color: "border-orange-200 bg-orange-50 hover:bg-orange-100" },
  { id: "adp", name: "ADP", type: "hris", description: "Sync HR data from ADP Workforce Now", color: "border-red-200 bg-red-50 hover:bg-red-100" },
  { id: "salesforce", name: "Salesforce", type: "crm", description: "Sync contacts and push training data", color: "border-blue-200 bg-blue-50 hover:bg-blue-100" },
  { id: "hubspot", name: "HubSpot", type: "crm", description: "Sync contacts and training data with HubSpot", color: "border-orange-200 bg-orange-50 hover:bg-orange-100" },
  { id: "custom_webhook", name: "Custom Webhook", type: "hr_system", description: "Connect via custom webhook", color: "border-gray-200 bg-gray-50 hover:bg-gray-100" },
];

const CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string; type: string; placeholder: string }>> = {
  bamboohr: [
    { key: "subdomain", label: "Company Subdomain", type: "text", placeholder: "yourcompany" },
    { key: "api_key_encrypted", label: "API Key", type: "password", placeholder: "Enter BambooHR API key" },
  ],
  workday: [
    { key: "base_url", label: "Workday API URL", type: "url", placeholder: "https://wd5-impl-services1.workday.com" },
    { key: "tenant_id", label: "Tenant ID", type: "text", placeholder: "your_tenant" },
    { key: "api_key_encrypted", label: "API Token", type: "password", placeholder: "Enter Workday API token" },
  ],
  adp: [
    { key: "base_url", label: "ADP API URL", type: "url", placeholder: "https://api.adp.com" },
    { key: "client_id", label: "Client ID", type: "text", placeholder: "Enter ADP client ID" },
    { key: "client_secret_encrypted", label: "Client Secret", type: "password", placeholder: "Enter ADP client secret" },
  ],
  salesforce: [
    { key: "instance_url", label: "Instance URL", type: "url", placeholder: "https://yourorg.salesforce.com" },
    { key: "access_token", label: "Access Token", type: "password", placeholder: "Enter Salesforce access token" },
  ],
  hubspot: [
    { key: "access_token", label: "Private App Access Token", type: "password", placeholder: "Enter HubSpot access token" },
  ],
  custom_webhook: [
    { key: "base_url", label: "Webhook URL", type: "url", placeholder: "https://your-api.example.com/webhooks/lms" },
    { key: "api_key_encrypted", label: "API Key (optional)", type: "password", placeholder: "Enter API key for authentication" },
  ],
};

// ─── Component ──────────────────────────────────────────────────

export default function HRISIntegrationsClient({ initialIntegrations }: HRISIntegrationsClientProps) {
  const [view, setView] = useState<View>("list");
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>("provider");
  const [newIntegration, setNewIntegration] = useState({
    name: "",
    provider: "",
    type: "",
    sync_direction: "import",
    sync_frequency: "daily",
    config: {} as Record<string, string>,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field mappings for configure view
  const [mappings, setMappings] = useState<FieldMappingItem[]>([]);
  const [configTab, setConfigTab] = useState<"settings" | "mappings" | "sync">("settings");

  const selectedIntegration = integrations.find((i) => i.id === selectedId);

  // ─── Handlers ─────────────────────────────────────────────────

  const refreshIntegrations = useCallback(async () => {
    const res = await fetch("/api/integrations/external");
    if (res.ok) {
      const data = await res.json();
      setIntegrations(data.integrations || []);
    }
  }, []);

  const handleSync = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/external/${id}/sync`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Sync failed");
      }
      await refreshIntegrations();
    } catch {
      alert("Sync request failed");
    }
  }, [refreshIntegrations]);

  const handleToggle = useCallback(async (id: string, active: boolean) => {
    const res = await fetch(`/api/integrations/external/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active }),
    });
    if (res.ok) {
      await refreshIntegrations();
    }
  }, [refreshIntegrations]);

  const handleConfigure = useCallback(async (id: string) => {
    setSelectedId(id);
    setConfigTab("settings");
    setView("configure");

    // Fetch mappings
    const res = await fetch(`/api/integrations/external/${id}/mappings`);
    if (res.ok) {
      const data = await res.json();
      setMappings(data.mappings || []);
    }
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/external/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: newIntegration.provider,
          config: newIntegration.config,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newIntegration.name,
          type: newIntegration.type,
          provider: newIntegration.provider,
          config: newIntegration.config,
          sync_direction: newIntegration.sync_direction,
          sync_frequency: newIntegration.sync_frequency,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create integration");
      }

      await refreshIntegrations();
      setView("list");
      resetWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create integration");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveMappings = async (newMappings: FieldMappingItem[]) => {
    if (!selectedId) return;
    const res = await fetch(`/api/integrations/external/${selectedId}/mappings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings: newMappings }),
    });
    if (res.ok) {
      const data = await res.json();
      setMappings(data.mappings || []);
    } else {
      throw new Error("Failed to save mappings");
    }
  };

  const handleDeleteIntegration = async () => {
    if (!selectedId || !confirm("Are you sure you want to delete this integration?")) return;
    const res = await fetch(`/api/integrations/external/${selectedId}`, { method: "DELETE" });
    if (res.ok) {
      await refreshIntegrations();
      setView("list");
      setSelectedId(null);
    }
  };

  const resetWizard = () => {
    setWizardStep("provider");
    setNewIntegration({ name: "", provider: "", type: "", sync_direction: "import", sync_frequency: "daily", config: {} });
    setTestResult(null);
    setError(null);
  };

  // ─── Render: List View ────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HRIS & CRM Integrations</h1>
            <p className="mt-1 text-sm text-gray-500">
              Connect your HR systems and CRMs to sync user data and push training records
            </p>
          </div>
          <button
            onClick={() => { resetWizard(); setView("add"); }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Integration
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{integrations.length}</p>
                <p className="text-xs text-gray-500">Total Integrations</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {integrations.filter((i) => i.is_active).length}
                </p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {integrations.filter((i) => i.last_sync_status === "completed").length}
                </p>
                <p className="text-xs text-gray-500">Last Sync OK</p>
              </div>
            </div>
          </div>
        </div>

        {/* Integration cards */}
        {integrations.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {integrations.map((integration) => (
              <ProviderCard
                key={integration.id}
                integration={integration as ProviderInfo}
                onConfigure={handleConfigure}
                onSync={handleSync}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
            <Database className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-3 text-sm font-semibold text-gray-700">No integrations configured</h3>
            <p className="mt-1 text-sm text-gray-500">Connect your HRIS or CRM to sync user data</p>
            <button
              onClick={() => { resetWizard(); setView("add"); }}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Your First Integration
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Add Wizard ───────────────────────────────────────

  if (view === "add") {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("list")}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Add Integration</h1>
            <p className="text-sm text-gray-500">Connect a new HRIS or CRM system</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {(["provider", "credentials", "mappings", "review"] as WizardStep[]).map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                wizardStep === step
                  ? "bg-blue-600 text-white"
                  : (["provider", "credentials", "mappings", "review"].indexOf(wizardStep) > i)
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-400"
              )}>
                {i + 1}
              </div>
              <span className={cn("text-xs font-medium capitalize", wizardStep === step ? "text-gray-900" : "text-gray-400")}>
                {step}
              </span>
              {i < 3 && <ArrowRight className="h-3 w-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step: Provider */}
        {wizardStep === "provider" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Select a Provider</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setNewIntegration((prev) => ({
                      ...prev,
                      provider: p.id,
                      type: p.type,
                      name: `${p.name} Integration`,
                    }));
                    setWizardStep("credentials");
                  }}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-all",
                    p.color
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/80 text-xs font-bold text-gray-700">
                      {p.name.substring(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{p.type}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Credentials */}
        {wizardStep === "credentials" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Enter Credentials</h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Integration Name</label>
              <input
                type="text"
                value={newIntegration.name}
                onChange={(e) => setNewIntegration((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
              />
            </div>

            {CREDENTIAL_FIELDS[newIntegration.provider]?.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                <input
                  type={field.type}
                  value={newIntegration.config[field.key] || ""}
                  onChange={(e) =>
                    setNewIntegration((prev) => ({
                      ...prev,
                      config: { ...prev.config, [field.key]: e.target.value },
                    }))
                  }
                  placeholder={field.placeholder}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sync Direction</label>
                <select
                  value={newIntegration.sync_direction}
                  onChange={(e) => setNewIntegration((prev) => ({ ...prev, sync_direction: e.target.value }))}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 outline-none"
                >
                  <option value="import">Import Only</option>
                  <option value="export">Export Only</option>
                  <option value="both">Bidirectional</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sync Frequency</label>
                <select
                  value={newIntegration.sync_frequency}
                  onChange={(e) => setNewIntegration((prev) => ({ ...prev, sync_frequency: e.target.value }))}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 outline-none"
                >
                  <option value="manual">Manual</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="realtime">Real-time</option>
                </select>
              </div>
            </div>

            {/* Test connection */}
            <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Test Connection
              </button>
              {testResult && (
                <span className={cn("flex items-center gap-1 text-sm", testResult.success ? "text-green-600" : "text-red-600")}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {testResult.message}
                </span>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setWizardStep("provider")}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setWizardStep("review")}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {wizardStep === "review" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Review & Create</h2>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Name</span>
                <span className="text-sm font-medium text-gray-800">{newIntegration.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Provider</span>
                <span className="text-sm font-medium text-gray-800 capitalize">{newIntegration.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Type</span>
                <span className="text-sm font-medium text-gray-800 uppercase">{newIntegration.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Direction</span>
                <span className="text-sm font-medium text-gray-800 capitalize">{newIntegration.sync_direction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Frequency</span>
                <span className="text-sm font-medium text-gray-800 capitalize">{newIntegration.sync_frequency}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setWizardStep("credentials")}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Integration
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Configure View ───────────────────────────────────

  if (view === "configure" && selectedIntegration) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("list")}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{selectedIntegration.name}</h1>
            <p className="text-sm text-gray-500 capitalize">{selectedIntegration.provider} &middot; {selectedIntegration.type.toUpperCase()}</p>
          </div>
          <button
            onClick={handleDeleteIntegration}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { id: "settings" as const, label: "Settings", icon: Settings },
            { id: "mappings" as const, label: "Field Mappings", icon: Database },
            { id: "sync" as const, label: "Sync History", icon: RefreshCw },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setConfigTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                configTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {configTab === "settings" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Integration Settings</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sync Direction</label>
                <p className="text-sm text-gray-800 capitalize">{selectedIntegration.sync_direction}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sync Frequency</label>
                <p className="text-sm text-gray-800 capitalize">{selectedIntegration.sync_frequency}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <p className="text-sm">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", selectedIntegration.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                    {selectedIntegration.is_active ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last Sync</label>
                <p className="text-sm text-gray-800">
                  {selectedIntegration.last_sync_at
                    ? new Date(selectedIntegration.last_sync_at).toLocaleString()
                    : "Never"}
                </p>
              </div>
            </div>
          </div>
        )}

        {configTab === "mappings" && (
          <FieldMapper
            integrationId={selectedIntegration.id}
            provider={selectedIntegration.provider}
            mappings={mappings}
            onSave={handleSaveMappings}
          />
        )}

        {configTab === "sync" && (
          <SyncStatus
            integrationId={selectedIntegration.id}
            onRefresh={refreshIntegrations}
          />
        )}
      </div>
    );
  }

  return null;
}
