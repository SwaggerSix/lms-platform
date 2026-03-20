"use client";

import { useState } from "react";
import {
  Bell,
  CalendarDays,
  AppWindow,
  Bot,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Copy,
  ChevronLeft,
  Send,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/utils/cn";

// ─── Types ──────────────────────────────────────────────────────

type Tab = "notifications" | "calendar" | "tab-app" | "bot";

interface TeamsIntegrationClientProps {
  initialWebhookUrl: string;
  initialCalendarEnabled: boolean;
}

// ─── Component ──────────────────────────────────────────────────

export default function TeamsIntegrationClient({
  initialWebhookUrl,
  initialCalendarEnabled,
}: TeamsIntegrationClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("notifications");

  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "tab-app", label: "Tab App", icon: AppWindow },
    { id: "bot", label: "Bot", icon: Bot },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/settings"
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Microsoft Teams Integration
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure Teams notifications, calendar sync, tab app, and bot
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "notifications" && (
        <NotificationsTab initialWebhookUrl={initialWebhookUrl} />
      )}
      {activeTab === "calendar" && (
        <CalendarTab initialEnabled={initialCalendarEnabled} />
      )}
      {activeTab === "tab-app" && <TabAppTab />}
      {activeTab === "bot" && <BotTab />}
    </div>
  );
}

// ─── Notifications Tab ──────────────────────────────────────────

function NotificationsTab({ initialWebhookUrl }: { initialWebhookUrl: string }) {
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "teams_webhook_url",
          value: { webhook_url: webhookUrl },
        }),
      });

      if (res.ok) {
        setSaveResult({ success: true, message: "Webhook URL saved" });
      } else {
        const data = await res.json();
        setSaveResult({ success: false, message: data.error || "Failed to save" });
      }
    } catch {
      setSaveResult({ success: false, message: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      setTestResult({ success: false, message: "Enter a webhook URL first" });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/teams/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || data.error || "Unknown result",
      });
    } catch {
      setTestResult({ success: false, message: "Failed to send test message" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Teams Channel Webhook
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Send LMS notifications (enrollments, completions, certificates) to a
          Teams channel using a Power Automate workflow or incoming webhook.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="webhook-url"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Webhook URL
            </label>
            <input
              id="webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setSaveResult(null);
                setTestResult(null);
              }}
              placeholder="https://outlook.office.com/webhook/..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Create a Power Automate workflow for your Teams channel and paste
              the generated webhook URL here.
            </p>
          </div>

          {/* Power Automate setup guide */}
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
            <h4 className="text-xs font-semibold text-blue-800">
              How to create a Power Automate Workflow webhook
            </h4>
            <ol className="mt-2 space-y-1.5 text-xs text-blue-700">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>Open Microsoft Teams and navigate to the target channel.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>
                  Right-click the channel name and select{" "}
                  <strong>Workflows</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>
                  Choose{" "}
                  <strong>&quot;Post to a channel when a webhook request is received&quot;</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">4.</span>
                <span>Follow the prompts to create the workflow.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">5.</span>
                <span>Copy the webhook URL and paste it into the field above.</span>
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save
            </button>

            <button
              onClick={handleTest}
              disabled={testing || !webhookUrl}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Test Message
            </button>
          </div>

          {saveResult && (
            <StatusMessage
              success={saveResult.success}
              message={saveResult.message}
            />
          )}
          {testResult && (
            <StatusMessage
              success={testResult.success}
              message={testResult.message}
            />
          )}
        </div>
      </div>

      {/* Supported events */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Supported Events
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          The following LMS events will send Adaptive Card notifications to your
          Teams channel:
        </p>
        <ul className="mt-3 space-y-2">
          {[
            { event: "Course Enrollment", description: "When a learner enrolls in a course" },
            { event: "Course Completion", description: "When a learner completes a course" },
            { event: "Certificate Earned", description: "When a certificate is issued" },
            { event: "New User Registered", description: "When a new user signs up" },
          ].map((item) => (
            <li
              key={item.event}
              className="flex items-start gap-2 text-sm"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              <div>
                <span className="font-medium text-gray-800">{item.event}</span>
                <span className="text-gray-500"> - {item.description}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Calendar Tab ───────────────────────────────────────────────

function CalendarTab({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleToggle = async (newValue: boolean) => {
    setEnabled(newValue);
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "teams_calendar_sync",
          value: { enabled: newValue },
        }),
      });

      if (res.ok) {
        setSaveResult({
          success: true,
          message: newValue ? "Calendar sync enabled" : "Calendar sync disabled",
        });
      } else {
        setEnabled(!newValue); // revert
        const data = await res.json();
        setSaveResult({ success: false, message: data.error || "Failed to save" });
      }
    } catch {
      setEnabled(!newValue); // revert
      setSaveResult({ success: false, message: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/teams/calendar-test", {
        method: "POST",
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || data.error || "Unknown result",
      });
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Calendar Sync for ILT Sessions
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Automatically create Teams/Outlook calendar events when ILT
              sessions are scheduled.
            </p>
          </div>
          <button
            onClick={() => handleToggle(!enabled)}
            disabled={saving}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              enabled ? "bg-blue-600" : "bg-gray-300",
              saving && "opacity-50"
            )}
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle calendar sync"
          >
            <span
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Test Azure AD Connection
          </button>
        </div>

        <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-700">
            Azure AD Connection Permissions
          </p>
          <p className="mt-1 text-xs text-gray-500">
            The connection uses the Azure AD app registration credentials
            configured in your environment variables. The following Microsoft
            Graph API permissions are granted:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
              <code className="font-mono">Calendars.ReadWrite</code>{" "}
              <span className="text-gray-400">- Create and manage calendar events</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
              <code className="font-mono">Group.Read.All</code>{" "}
              <span className="text-gray-400">- Read Teams/group membership for calendar targeting</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
              <code className="font-mono">User.Read.All</code>{" "}
              <span className="text-gray-400">- Resolve user identities for event invitations</span>
            </li>
          </ul>
        </div>

        {saveResult && (
          <div className="mt-3">
            <StatusMessage
              success={saveResult.success}
              message={saveResult.message}
            />
          </div>
        )}
        {testResult && (
          <div className="mt-3">
            <StatusMessage
              success={testResult.success}
              message={testResult.message}
            />
          </div>
        )}
      </div>

      {/* Connection status */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Connection Details
        </h3>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium text-gray-600">Status</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                enabled
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium text-gray-600">
              Auth Method
            </span>
            <span className="text-xs text-gray-800">
              Client Credentials (App-Only)
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium text-gray-600">
              Graph API Scope
            </span>
            <span className="text-xs font-mono text-gray-800">
              Calendars.ReadWrite
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Calendar events are created via Microsoft Graph API using app-only
          authentication. Ensure the Azure AD app registration has
          Calendars.ReadWrite application permission granted with admin consent.
        </p>
      </div>
    </div>
  );
}

// ─── Tab App Tab ────────────────────────────────────────────────

function TabAppTab() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/teams/manifest");
      if (!res.ok) {
        alert("Failed to download manifest");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "learnhub-teams-app.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Teams Tab App Manifest
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Download the Teams app manifest package to install LearnHub as a tab
          in Microsoft Teams.
        </p>

        <div className="mt-4">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Manifest ZIP
          </button>
        </div>
      </div>

      {/* Installation instructions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Installation Instructions
        </h3>
        <ol className="mt-3 space-y-3 text-sm text-gray-600">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              1
            </span>
            <span>
              Download the manifest ZIP file using the button above.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              2
            </span>
            <span>
              Open Microsoft Teams and go to <strong>Apps</strong> in the
              sidebar.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              3
            </span>
            <span>
              Click <strong>Manage your apps</strong>, then{" "}
              <strong>Upload a custom app</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              4
            </span>
            <span>
              Select the downloaded ZIP file to install LearnHub in Teams.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              5
            </span>
            <span>
              The app will appear as a personal tab (Dashboard) and can be added
              to channels as a configurable tab.
            </span>
          </li>
        </ol>
      </div>

      {/* Manifest details */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Manifest Details
        </h3>
        <div className="mt-3 space-y-2">
          {[
            { label: "App ID", value: "8f0b9c26-2b2a-4655-8e36-32ad350ef6e4" },
            { label: "Version", value: "1.0.0" },
            { label: "Domain", value: "learn.gothamgovernment.com" },
            {
              label: "Static Tabs",
              value: "Dashboard, My Courses, Course Catalog",
            },
            { label: "Configurable Tabs", value: "Team & Group Chat" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
            >
              <span className="text-xs font-medium text-gray-600">
                {item.label}
              </span>
              <span className="text-xs text-gray-800">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Bot Tab ────────────────────────────────────────────────────

function BotTab() {
  const botEndpoint = "https://learn.gothamgovernment.com/api/teams/bot";

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(botEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Teams Bot Endpoint
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Use this endpoint URL when configuring your bot in Azure Bot Service.
          The bot requires a separate{" "}
          <a
            href="https://portal.azure.com/#create/Microsoft.AzureBot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Azure Bot Service registration
          </a>{" "}
          before it can receive messages from Teams.
        </p>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Messaging Endpoint (Production)
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-800">
              {botEndpoint}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            This is the production URL. Copy this value into the{" "}
            <strong>Messaging endpoint</strong> field in your Azure Bot Service
            configuration.
          </p>
        </div>

        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-xs text-amber-800">
              <p className="font-medium">Azure Bot Service registration required</p>
              <p className="mt-1">
                Before the bot can work in Teams, you must create an Azure Bot
                resource in the{" "}
                <a
                  href="https://portal.azure.com/#create/Microsoft.AzureBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-amber-900"
                >
                  Azure Portal
                </a>
                , connect it to your existing App Registration, set the messaging
                endpoint above, and enable the Microsoft Teams channel.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Supported commands */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Supported Commands
        </h3>
        <div className="mt-3 space-y-2">
          {[
            {
              command: "my courses",
              description: "View enrolled courses and progress",
            },
            {
              command: "progress",
              description: "Check overall learning progress and stats",
            },
            {
              command: "help",
              description: "Show available bot commands",
            },
          ].map((item) => (
            <div
              key={item.command}
              className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2"
            >
              <code className="rounded bg-gray-200 px-2 py-0.5 text-xs font-mono font-medium text-gray-800">
                {item.command}
              </code>
              <span className="text-xs text-gray-600">{item.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Setup instructions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Azure Bot Service Setup
        </h3>
        <ol className="mt-3 space-y-3 text-sm text-gray-600">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              1
            </span>
            <span>
              Go to the{" "}
              <a
                href="https://portal.azure.com/#create/Microsoft.AzureBot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                Azure Portal
              </a>{" "}
              and create a new Azure Bot resource.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              2
            </span>
            <span>
              Use the existing App Registration (Client ID:{" "}
              <code className="rounded bg-gray-100 px-1 text-xs">
                8f0b9c26-2b2a-4655-8e36-32ad350ef6e4
              </code>
              ).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              3
            </span>
            <span>
              Set the <strong>Messaging endpoint</strong> to the URL shown
              above.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              4
            </span>
            <span>
              Under <strong>Channels</strong>, add the{" "}
              <strong>Microsoft Teams</strong> channel.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              5
            </span>
            <span>
              The bot will be available in Teams once the channel is configured
              and the app manifest is deployed.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────

function StatusMessage({
  success,
  message,
}: {
  success: boolean;
  message: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        success
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      {success ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
}
