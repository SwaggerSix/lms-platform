"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Settings,
  RefreshCw,
  Loader2,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/utils/cn";

// ─── Types ───────────────────────────────────────────────────────

export interface ProviderInfo {
  id: string;
  name: string;
  provider: string;
  type: string;
  is_active: boolean;
  sync_direction: string;
  sync_frequency: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
}

interface ProviderCardProps {
  integration: ProviderInfo;
  onConfigure: (id: string) => void;
  onSync: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

// ─── Provider metadata ──────────────────────────────────────────

const PROVIDER_META: Record<string, { label: string; color: string; bgColor: string; description: string }> = {
  bamboohr: {
    label: "BambooHR",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    description: "Sync employee data from BambooHR",
  },
  workday: {
    label: "Workday",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    description: "Import workforce data from Workday HCM",
  },
  adp: {
    label: "ADP",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    description: "Sync HR data from ADP Workforce Now",
  },
  salesforce: {
    label: "Salesforce",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    description: "Sync contacts and push training data to Salesforce",
  },
  hubspot: {
    label: "HubSpot",
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200",
    description: "Sync contacts and training data with HubSpot CRM",
  },
  custom_webhook: {
    label: "Custom Webhook",
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200",
    description: "Connect via custom webhook endpoint",
  },
};

// ─── Component ──────────────────────────────────────────────────

export default function ProviderCard({ integration, onConfigure, onSync, onToggle }: ProviderCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const meta = PROVIDER_META[integration.provider] || {
    label: integration.provider,
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200",
    description: "",
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync(integration.id);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(integration.id, !integration.is_active);
    } finally {
      setToggling(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  const syncStatusColor = (status: string | null) => {
    switch (status) {
      case "completed": return "text-green-600";
      case "failed": return "text-red-600";
      case "partial": return "text-yellow-600";
      case "started": return "text-blue-600";
      default: return "text-gray-400";
    }
  };

  return (
    <div className={cn("rounded-lg border p-5 transition-all hover:shadow-md", meta.bgColor)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg font-bold text-sm", meta.color, "bg-white/60")}>
            {meta.label.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className={cn("font-semibold", meta.color)}>{integration.name}</h3>
            <p className="text-xs text-gray-500">{meta.label} &middot; {integration.type.toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {integration.is_active ? (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <Wifi className="h-3 w-3" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              <WifiOff className="h-3 w-3" /> Inactive
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="mt-2 text-sm text-gray-600">{meta.description}</p>

      {/* Sync Info */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {integration.sync_frequency}
        </span>
        <span className="flex items-center gap-1">
          {integration.last_sync_status === "completed" ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : integration.last_sync_status === "failed" ? (
            <XCircle className="h-3 w-3 text-red-500" />
          ) : null}
          <span className={syncStatusColor(integration.last_sync_status)}>
            Last sync: {formatDate(integration.last_sync_at)}
          </span>
        </span>
      </div>

      {/* Sync direction badge */}
      <div className="mt-2">
        <span className="inline-block rounded bg-white/70 px-2 py-0.5 text-xs text-gray-600">
          Direction: {integration.sync_direction}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-white/40 pt-3">
        <button
          onClick={() => onConfigure(integration.id)}
          className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Configure
        </button>
        <button
          onClick={handleSync}
          disabled={syncing || !integration.is_active}
          className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sync Now
        </button>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={cn(
            "ml-auto flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            integration.is_active
              ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
              : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
          )}
        >
          {toggling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : integration.is_active ? (
            "Deactivate"
          ) : (
            "Activate"
          )}
        </button>
      </div>
    </div>
  );
}
