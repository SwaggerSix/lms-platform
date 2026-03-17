"use client";

import { useState, useCallback } from "react";
import { Upload, Plus, Send, Globe, Loader2, Copy } from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";

export interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  created: string;
  lastUsed: string;
  status: "Active" | "Revoked";
}

export interface NotificationType {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface SettingsData {
  general: {
    companyName: string;
    timezone: string;
    language: string;
    dateFormat: string;
  };
  branding: {
    primaryColor: string;
    accentColor: string;
  };
  features: FeatureToggle[];
  notifications: {
    types: NotificationType[];
    emailFooter: string;
    webhookUrl: string;
    selectedWebhookEvents: string[];
  };
  apiKeys: ApiKey[];
}

const webhookEvents = ["user.created", "user.updated", "course.completed", "enrollment.created", "certificate.issued", "quiz.submitted"];

const tabs = ["General", "Branding", "Email", "Features", "API"] as const;

export default function SettingsClient({ data }: { data: SettingsData }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<string>("General");
  const [companyName, setCompanyName] = useState(data.general.companyName);
  const [timezone, setTimezone] = useState(data.general.timezone);
  const [language, setLanguage] = useState(data.general.language);
  const [dateFormat, setDateFormat] = useState(data.general.dateFormat);
  const [primaryColor, setPrimaryColor] = useState(data.branding.primaryColor);
  const [accentColor, setAccentColor] = useState(data.branding.accentColor);
  const [notifications, setNotifications] = useState(data.notifications.types);
  const [emailFooter, setEmailFooter] = useState(data.notifications.emailFooter);
  const [features, setFeatures] = useState(data.features);
  const [webhookUrl, setWebhookUrl] = useState(data.notifications.webhookUrl);
  const [selectedWebhookEvents, setSelectedWebhookEvents] = useState<Set<string>>(new Set(data.notifications.selectedWebhookEvents));

  const toggleNotification = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n)));
  };

  const toggleFeature = (id: string) => {
    setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  };

  const toggleWebhookEvent = (event: string) => {
    setSelectedWebhookEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(data.apiKeys);
  const [saving, setSaving] = useState<string | null>(null);
  const [testEmailStatus, setTestEmailStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const handleSendTestEmail = useCallback(async () => {
    setTestEmailStatus("sending");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test", subject: "Test Email from LMS Platform", to: "admin" }),
      });
      if (!res.ok) {
        throw new Error("Failed to send");
      }
      setTestEmailStatus("success");
      setTimeout(() => setTestEmailStatus("idle"), 3000);
    } catch {
      setTestEmailStatus("error");
      setTimeout(() => setTestEmailStatus("idle"), 3000);
    }
  }, []);

  const handleGenerateKey = useCallback(async () => {
    const newKey = crypto.randomUUID();
    setGeneratedKey(newKey);
    const newApiKey: ApiKey = {
      id: crypto.randomUUID(),
      name: `API Key ${apiKeys.length + 1}`,
      keyPreview: `${newKey.slice(0, 8)}...${newKey.slice(-4)}`,
      created: new Date().toISOString().split("T")[0],
      lastUsed: "Never",
      status: "Active",
    };
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "apiKeys.create", value: { id: newApiKey.id, name: newApiKey.name } }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save API key");
        return;
      }
    } catch {
      toast.error("Failed to save API key");
      return;
    }
    setApiKeys((prev) => [...prev, newApiKey]);
  }, [apiKeys.length]);

  const handleRevokeKey = useCallback(async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke the API key "${keyName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "apiKeys.revoke", value: { id: keyId } }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to revoke API key");
        return;
      }
    } catch {
      toast.error("Failed to revoke API key");
      return;
    }
    setApiKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, status: "Revoked" as const } : k)));
  }, []);

  const saveSetting = async (key: string, value: unknown) => {
    setSaving(key);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your LMS platform configuration and preferences</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "border-b-2 pb-3 text-sm font-medium transition-colors",
                activeTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "General" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <div className="relative max-w-md">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">GMT (London)</option>
                <option value="Europe/Berlin">CET (Berlin)</option>
                <option value="Asia/Tokyo">JST (Tokyo)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese (Simplified)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <button
              disabled={saving === "general"}
              onClick={() => saveSetting("general", { companyName, timezone, language, dateFormat })}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving === "general" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {activeTab === "Branding" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div>
              <p className="text-sm font-medium text-indigo-900">Advanced Branding</p>
              <p className="text-xs text-indigo-700">Full portal customization with live preview, theme presets, and login page styling</p>
            </div>
            <a href="/admin/settings/branding" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              Open Branding Studio
            </a>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
            <div className="flex items-center justify-center w-full max-w-md h-32 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400">SVG, PNG, JPG (max. 2MB)</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
            <div className="flex items-center gap-3 max-w-md">
              <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <div className="h-10 w-10 rounded-lg border border-gray-300 shadow-inner" style={{ backgroundColor: primaryColor }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color</label>
            <div className="flex items-center gap-3 max-w-md">
              <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <div className="h-10 w-10 rounded-lg border border-gray-300 shadow-inner" style={{ backgroundColor: accentColor }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Favicon</label>
            <div className="flex items-center justify-center w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
              <div className="text-center">
                <Upload className="mx-auto h-6 w-6 text-gray-400" />
                <p className="mt-1 text-xs text-gray-500">Upload favicon</p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <button
              disabled={saving === "branding"}
              onClick={() => saveSetting("branding", { primaryColor, accentColor })}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving === "branding" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {activeTab === "Email" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Email Notifications</h3>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Notification Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Enabled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {notifications.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{n.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{n.description}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleNotification(n.id)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", n.enabled ? "bg-indigo-600" : "bg-gray-300")}>
                          <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm", n.enabled ? "translate-x-6" : "translate-x-1")} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Footer Text</label>
            <textarea value={emailFooter} onChange={(e) => setEmailFooter(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={testEmailStatus === "sending"}
              onClick={handleSendTestEmail}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testEmailStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {testEmailStatus === "sending" ? "Sending..." : testEmailStatus === "success" ? "Test Email Sent!" : testEmailStatus === "error" ? "Failed to Send" : "Send Test Email"}
            </button>
            {testEmailStatus === "success" && <span className="text-sm text-green-600">Check your inbox</span>}
            {testEmailStatus === "error" && <span className="text-sm text-red-600">Could not send test email</span>}
          </div>
          <div className="pt-4 border-t border-gray-200">
            <button
              disabled={saving === "notifications"}
              onClick={() => saveSetting("notifications", { types: notifications, emailFooter, webhookUrl, selectedWebhookEvents: Array.from(selectedWebhookEvents) })}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving === "notifications" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {activeTab === "Features" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-1">
          {features.map((feature, idx) => (
            <div key={feature.id} className={cn("flex items-center justify-between rounded-lg p-4", idx % 2 === 0 ? "bg-gray-50" : "")}>
              <div>
                <p className="text-sm font-medium text-gray-900">{feature.name}</p>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </div>
              <button onClick={() => toggleFeature(feature.id)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4", feature.enabled ? "bg-indigo-600" : "bg-gray-300")}>
                <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm", feature.enabled ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>
          ))}
          <div className="pt-5 border-t border-gray-200 mt-4">
            <button
              disabled={saving === "features"}
              onClick={() => saveSetting("features", features)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving === "features" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {activeTab === "API" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">API Keys</h3>
              <button
                onClick={handleGenerateKey}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Generate New Key
              </button>
            </div>
            {generatedKey && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-900 mb-1">New API Key Generated</p>
                <p className="text-xs text-green-700 mb-2">Copy this key now. You will not be able to see it again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-3 py-2 text-sm text-gray-900 border border-green-200 font-mono">{generatedKey}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                  <button
                    onClick={() => setGeneratedKey(null)}
                    className="rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Key Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Key</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Last Used</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{key.name}</td>
                      <td className="px-4 py-3"><code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{key.keyPreview}</code></td>
                      <td className="px-4 py-3 text-sm text-gray-500">{key.created}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{key.lastUsed}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", key.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{key.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {key.status === "Active" && <button onClick={() => handleRevokeKey(key.id, key.name)} className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">Revoke</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Webhooks</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
              <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="https://your-api.com/webhooks" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Webhook Events</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {webhookEvents.map((event) => (
                  <label key={event} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={selectedWebhookEvents.has(event)} onChange={() => toggleWebhookEvent(event)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <button
                disabled={saving === "webhooks"}
                onClick={() => saveSetting("webhooks", { webhookUrl, selectedWebhookEvents: Array.from(selectedWebhookEvents) })}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving === "webhooks" && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
