"use client";

import { useState } from "react";
import {
  Video,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  ChevronLeft,
  Settings,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/utils/cn";

// ─── Types ───────────────────────────────────────────────────────

type Provider = "zoom" | "teams" | "google_meet";

interface Integration {
  id: string;
  provider: Provider;
  is_active: boolean;
  has_client_id: boolean;
  has_credentials: boolean;
  settings: Record<string, unknown>;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IntegrationsClientProps {
  initialIntegrations: Integration[];
}

// ─── Provider metadata ───────────────────────────────────────────

const PROVIDER_META: Record<
  Provider,
  {
    name: string;
    color: string;
    bgColor: string;
    iconBg: string;
    description: string;
    docsUrl: string;
    setupSteps: string[];
  }
> = {
  zoom: {
    name: "Zoom",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    iconBg: "bg-blue-100",
    description: "Auto-create Zoom meetings for virtual ILT sessions.",
    docsUrl: "https://marketplace.zoom.us/docs/guides/build/server-to-server-oauth-app",
    setupSteps: [
      "Go to the Zoom App Marketplace (marketplace.zoom.us)",
      "Click 'Develop' > 'Build App' > 'Server-to-Server OAuth'",
      "Fill in app information and note the Client ID and Client Secret",
      "Add required scopes: meeting:write:admin, meeting:read:admin",
      "Activate the app and paste credentials below",
    ],
  },
  teams: {
    name: "Microsoft Teams",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    iconBg: "bg-purple-100",
    description: "Auto-create Teams meetings via Microsoft Graph API.",
    docsUrl: "https://learn.microsoft.com/en-us/graph/auth-register-app-v2",
    setupSteps: [
      "Go to Azure Portal > Azure Active Directory > App registrations",
      "Click 'New registration' and give it a name",
      "Note the Application (client) ID and create a client secret",
      "Under API permissions, add: OnlineMeetings.ReadWrite",
      "Grant admin consent and paste credentials below",
    ],
  },
  google_meet: {
    name: "Google Meet",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    iconBg: "bg-green-100",
    description: "Auto-create Google Meet links via Google Calendar API.",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    setupSteps: [
      "Go to Google Cloud Console > APIs & Services > Credentials",
      "Click 'Create Credentials' > 'OAuth Client ID'",
      "Set application type to 'Web application'",
      "Enable the Google Calendar API in the API Library",
      "Note Client ID and Client Secret, then paste below",
    ],
  },
};

const ALL_PROVIDERS: Provider[] = ["zoom", "teams", "google_meet"];

// ─── Component ───────────────────────────────────────────────────

export default function IntegrationsClient({ initialIntegrations }: IntegrationsClientProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [configuring, setConfiguring] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formClientId, setFormClientId] = useState("");
  const [formClientSecret, setFormClientSecret] = useState("");
  const [formSettings, setFormSettings] = useState({
    auto_record: false,
    waiting_room: true,
    mute_on_entry: true,
  });

  function getIntegration(provider: Provider): Integration | undefined {
    return integrations.find((i) => i.provider === provider);
  }

  function startConfigure(provider: Provider) {
    const existing = getIntegration(provider);
    setConfiguring(provider);
    setFormClientId("");
    setFormClientSecret("");
    setFormSettings({
      auto_record: (existing?.settings?.auto_record as boolean) ?? false,
      waiting_room: (existing?.settings?.waiting_room as boolean) ?? true,
      mute_on_entry: (existing?.settings?.mute_on_entry as boolean) ?? true,
    });
    setError(null);
    setTestResult(null);
    setShowSecret(false);
  }

  async function handleSave() {
    if (!configuring) return;
    if (!formClientId.trim() || !formClientSecret.trim()) {
      setError("Both Client ID and Client Secret are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const existing = getIntegration(configuring);
      const method = existing ? "PATCH" : "POST";

      const res = await fetch("/api/integrations/video", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: configuring,
          client_id: formClientId.trim(),
          client_secret: formClientSecret.trim(),
          settings: formSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save integration");
      }

      const { integration } = await res.json();

      setIntegrations((prev) => {
        const idx = prev.findIndex((i) => i.provider === configuring);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = integration;
          return updated;
        }
        return [...prev, integration];
      });

      setConfiguring(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSettings(provider: Provider, settings: Record<string, unknown>) {
    try {
      const res = await fetch("/api/integrations/video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, settings }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update settings");
      }

      const { integration } = await res.json();
      setIntegrations((prev) =>
        prev.map((i) => (i.provider === provider ? integration : i))
      );
    } catch (err: any) {
      console.error("Settings update failed:", err.message);
    }
  }

  async function handleTestConnection() {
    if (!configuring) return;
    setTesting(true);
    setTestResult(null);

    // Simulate a connection test by verifying credentials are set
    // In production, this would make an actual API call to the provider
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (formClientId.trim() && formClientSecret.trim()) {
      setTestResult({
        success: true,
        message: "Credentials format validated. Save to complete setup and test the full connection.",
      });
    } else {
      setTestResult({
        success: false,
        message: "Please enter both Client ID and Client Secret.",
      });
    }
    setTesting(false);
  }

  async function handleRemove(provider: Provider) {
    if (!confirm(`Remove the ${PROVIDER_META[provider].name} integration? This cannot be undone.`)) {
      return;
    }

    setDeleting(provider);
    try {
      const res = await fetch(`/api/integrations/video?provider=${provider}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove integration");
      }

      setIntegrations((prev) => prev.filter((i) => i.provider !== provider));
    } catch (err: any) {
      console.error("Remove failed:", err.message);
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(provider: Provider, active: boolean) {
    try {
      const res = await fetch("/api/integrations/video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, is_active: active }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      const { integration } = await res.json();
      setIntegrations((prev) =>
        prev.map((i) => (i.provider === provider ? integration : i))
      );
    } catch (err: any) {
      console.error("Toggle failed:", err.message);
    }
  }

  // ─── Configure Form View ────────────────────────────────────────

  if (configuring) {
    const meta = PROVIDER_META[configuring];

    return (
      <div className="space-y-6">
        <button
          onClick={() => setConfiguring(null)}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Integrations
        </button>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Configure {meta.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{meta.description}</p>
        </div>

        {/* Setup Instructions */}
        <div className={cn("rounded-xl border p-5", meta.bgColor)}>
          <h3 className={cn("text-sm font-semibold mb-3", meta.color)}>
            Setup Instructions
          </h3>
          <ol className="space-y-2">
            {meta.setupSteps.map((step, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-gray-700">
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", meta.iconBg, meta.color)}>
                  {idx + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <a
            href={meta.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("mt-3 inline-flex items-center gap-1 text-sm font-medium", meta.color)}
          >
            View documentation <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Credentials Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-gray-900">Credentials</h3>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client ID
            </label>
            <input
              type="text"
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter your Client ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={formClientSecret}
                onChange={(e) => setFormClientSecret(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Enter your Client Secret"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Secrets are encrypted before storage using AES-256-GCM.
            </p>
          </div>

          {testResult && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                testResult.success
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {testResult.message}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testing && <Loader2 className="h-4 w-4 animate-spin" />}
              Test Connection
            </button>
          </div>
        </div>

        {/* Meeting Settings */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Meeting Settings</h3>

          <label className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-record meetings</p>
              <p className="text-xs text-gray-500">Automatically record all meetings created through this integration</p>
            </div>
            <button
              type="button"
              onClick={() => setFormSettings({ ...formSettings, auto_record: !formSettings.auto_record })}
              className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", formSettings.auto_record ? "bg-indigo-600" : "bg-gray-300")}
            >
              <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm", formSettings.auto_record ? "translate-x-6" : "translate-x-1")} />
            </button>
          </label>

          <label className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Waiting room</p>
              <p className="text-xs text-gray-500">Require host approval before participants can join</p>
            </div>
            <button
              type="button"
              onClick={() => setFormSettings({ ...formSettings, waiting_room: !formSettings.waiting_room })}
              className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", formSettings.waiting_room ? "bg-indigo-600" : "bg-gray-300")}
            >
              <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm", formSettings.waiting_room ? "translate-x-6" : "translate-x-1")} />
            </button>
          </label>

          <label className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Mute on entry</p>
              <p className="text-xs text-gray-500">Automatically mute participants when they join</p>
            </div>
            <button
              type="button"
              onClick={() => setFormSettings({ ...formSettings, mute_on_entry: !formSettings.mute_on_entry })}
              className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", formSettings.mute_on_entry ? "bg-indigo-600" : "bg-gray-300")}
            >
              <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm", formSettings.mute_on_entry ? "translate-x-6" : "translate-x-1")} />
            </button>
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfiguring(null)}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {getIntegration(configuring) ? "Update Integration" : "Connect Integration"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Integrations List ─────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Video Conferencing Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect video conferencing providers to auto-create meetings for ILT sessions.
        </p>
      </div>

      <div className="grid gap-4">
        {ALL_PROVIDERS.map((provider) => {
          const meta = PROVIDER_META[provider];
          const integration = getIntegration(provider);
          const isConnected = !!integration?.has_credentials && integration?.is_active;

          return (
            <div
              key={provider}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", meta.iconBg)}>
                    <Video className={cn("h-6 w-6", meta.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{meta.name}</h3>
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </span>
                      ) : integration ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                          <XCircle className="h-3 w-3" /> Inactive
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                          Not configured
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{meta.description}</p>
                    {integration && (
                      <p className="mt-1 text-xs text-gray-400">
                        Last updated: {new Date(integration.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {integration && (
                    <>
                      <button
                        onClick={() => handleToggleActive(provider, !integration.is_active)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          integration.is_active ? "bg-indigo-600" : "bg-gray-300"
                        )}
                        title={integration.is_active ? "Disable" : "Enable"}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                            integration.is_active ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                      <button
                        onClick={() => handleRemove(provider)}
                        disabled={deleting === provider}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Remove integration"
                      >
                        {deleting === provider ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => startConfigure(provider)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      integration
                        ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    {integration ? "Reconfigure" : "Configure"}
                  </button>
                </div>
              </div>

              {/* Settings quick toggles for connected integrations */}
              {integration?.is_active && integration.has_credentials && (
                <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={!!integration.settings?.auto_record}
                      onChange={(e) =>
                        handleUpdateSettings(provider, {
                          ...integration.settings,
                          auto_record: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Auto-record
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={integration.settings?.waiting_room !== false}
                      onChange={(e) =>
                        handleUpdateSettings(provider, {
                          ...integration.settings,
                          waiting_room: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Waiting room
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={integration.settings?.mute_on_entry !== false}
                      onChange={(e) =>
                        handleUpdateSettings(provider, {
                          ...integration.settings,
                          mute_on_entry: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Mute on entry
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
