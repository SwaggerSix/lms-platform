"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/utils/cn";

// ─── Types ───────────────────────────────────────────────────────

export interface SyncLog {
  id: string;
  integration_id: string;
  sync_type: string;
  status: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  errors: Array<{ record?: string; error: string }>;
  started_at: string;
  completed_at: string | null;
}

interface SyncStatusProps {
  integrationId: string;
  onRefresh?: () => void;
}

// ─── Component ──────────────────────────────────────────────────

export default function SyncStatus({ integrationId, onRefresh }: SyncStatusProps) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/external/${integrationId}/logs?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);

        // Check if there is an active sync
        const active = (data.logs || []).find((l: SyncLog) => l.status === "started");
        setActiveSyncId(active?.id || null);
      }
    } catch (err) {
      console.error("Failed to fetch sync logs:", err);
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Poll for active sync status
  useEffect(() => {
    if (!activeSyncId) return;

    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [activeSyncId, fetchLogs]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "In progress...";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff < 1000) return "<1s";
    if (diff < 60000) return `${Math.round(diff / 1000)}s`;
    return `${Math.round(diff / 60000)}m ${Math.round((diff % 60000) / 1000)}s`;
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "partial":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "started":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Completed";
      case "failed": return "Failed";
      case "partial": return "Partial";
      case "started": return "Running";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Sync History</h3>
        </div>
        <button
          onClick={() => { fetchLogs(); onRefresh?.(); }}
          className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* Active sync progress */}
      {activeSyncId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sync in progress...
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
            <div className="h-full animate-pulse rounded-full bg-blue-400" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {/* Sync log table */}
      {logs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Started</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Duration</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Processed</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Created</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Updated</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(log.status)}
                      <span className={cn(
                        "font-medium",
                        log.status === "completed" && "text-green-700",
                        log.status === "failed" && "text-red-700",
                        log.status === "partial" && "text-yellow-700",
                        log.status === "started" && "text-blue-700",
                      )}>
                        {statusLabel(log.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 capitalize">{log.sync_type}</td>
                  <td className="px-3 py-2 text-gray-600">{formatDate(log.started_at)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatDuration(log.started_at, log.completed_at)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800">{log.records_processed}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-600">{log.records_created}</td>
                  <td className="px-3 py-2 text-right font-mono text-blue-600">{log.records_updated}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600">{log.records_failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">No sync history yet</p>
          <p className="text-xs text-gray-300">Trigger a sync to see results here</p>
        </div>
      )}

      {/* Error details for last failed sync */}
      {logs[0]?.status === "failed" && logs[0].errors?.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <h4 className="text-xs font-semibold text-red-700">Last Sync Errors</h4>
          <ul className="mt-1 space-y-0.5">
            {logs[0].errors.slice(0, 5).map((err, i) => (
              <li key={i} className="text-xs text-red-600">
                {err.record && <span className="font-mono">{err.record}: </span>}
                {err.error}
              </li>
            ))}
            {logs[0].errors.length > 5 && (
              <li className="text-xs text-red-500 italic">
                ...and {logs[0].errors.length - 5} more errors
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
