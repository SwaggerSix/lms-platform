"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

export interface ErrorLogEntry {
  id: string;
  createdAt: string;
  source: string;
  severity: string;
  message: string;
  stack: string | null;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  digest: string | null;
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolverName: string | null;
  resolutionNotes: string | null;
}

interface ErrorLogClientProps {
  initialEntries: ErrorLogEntry[];
}

const severityStyles: Record<string, { badge: string; icon: React.ComponentType<{ className?: string }> }> = {
  fatal: { badge: "bg-red-100 text-red-700", icon: AlertOctagon },
  error: { badge: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  warning: { badge: "bg-amber-100 text-amber-700", icon: AlertCircle },
};

const sourceStyles: Record<string, string> = {
  api: "bg-blue-100 text-blue-700",
  server: "bg-purple-100 text-purple-700",
  client: "bg-cyan-100 text-cyan-700",
  cron: "bg-gray-100 text-gray-600",
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const exportCSV = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function ErrorLogClient({ initialEntries }: ErrorLogClientProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<ErrorLogEntry[]>(initialEntries);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Unresolved" | "Resolved">("Unresolved");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const matchesSearch =
          !search ||
          e.message.toLowerCase().includes(search.toLowerCase()) ||
          (e.path ?? "").toLowerCase().includes(search.toLowerCase());
        const matchesSeverity = severityFilter === "All" || e.severity === severityFilter;
        const matchesSource = sourceFilter === "All" || e.source === sourceFilter;
        const matchesStatus =
          statusFilter === "All" ||
          (statusFilter === "Resolved" ? e.resolved : !e.resolved);
        return matchesSearch && matchesSeverity && matchesSource && matchesStatus;
      }),
    [entries, search, severityFilter, sourceFilter, statusFilter]
  );

  const stats = useMemo(() => {
    const unresolved = entries.filter((e) => !e.resolved);
    return {
      total: entries.length,
      unresolved: unresolved.length,
      fatal: unresolved.filter((e) => e.severity === "fatal").length,
      resolved: entries.length - unresolved.length,
    };
  }, [entries]);

  const toggleResolved = async (entry: ErrorLogEntry) => {
    setBusyId(entry.id);
    try {
      const res = await fetch("/api/error-logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, resolved: !entry.resolved }),
      });
      if (res.ok) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  resolved: !e.resolved,
                  resolvedAt: !e.resolved ? new Date().toISOString() : null,
                }
              : e
          )
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const deleteEntry = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/error-logs?id=${id}`, { method: "DELETE" });
      if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const clearResolved = async () => {
    if (!confirm("Permanently delete all resolved error logs?")) return;
    const res = await fetch("/api/error-logs?scope=resolved", { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => !e.resolved));
  };

  const handleExport = () => {
    const data = filtered.map((e) => ({
      Timestamp: formatTimestamp(e.createdAt),
      Severity: e.severity,
      Source: e.source,
      Message: e.message,
      Path: e.path ?? "",
      Method: e.method ?? "",
      Status: e.statusCode ?? "",
      Resolved: e.resolved ? "Yes" : "No",
    }));
    exportCSV(data, `error_log_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const columns: DataTableColumn<ErrorLogEntry>[] = [
    {
      key: "time",
      header: "Time",
      sortValue: (e) => e.createdAt,
      render: (entry) => (
        <span className="text-sm text-gray-500 whitespace-nowrap">{formatTimestamp(entry.createdAt)}</span>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      sortValue: (e) => e.severity,
      render: (entry) => {
        const sev = severityStyles[entry.severity] ?? severityStyles.error;
        const SevIcon = sev.icon;
        return (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", sev.badge)}>
            <SevIcon className="h-3 w-3" />
            {entry.severity}
          </span>
        );
      },
    },
    {
      key: "source",
      header: "Source",
      sortValue: (e) => e.source,
      render: (entry) => (
        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", sourceStyles[entry.source] ?? "bg-gray-100 text-gray-600")}>
          {entry.source}
        </span>
      ),
    },
    {
      key: "message",
      header: "Message",
      className: "max-w-md",
      render: (entry) => <span className="line-clamp-1 text-sm text-gray-900">{entry.message}</span>,
    },
    {
      key: "location",
      header: "Location",
      sortValue: (e) => e.path,
      render: (entry) =>
        entry.path ? (
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {entry.method ? `${entry.method} ` : ""}
            {entry.path}
          </code>
        ) : (
          <span className="text-xs text-gray-500">—</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-20 text-right",
      render: (entry) => (
        <div className="flex items-center justify-end gap-1">
          <button
            disabled={busyId === entry.id}
            onClick={() => toggleResolved(entry)}
            title={entry.resolved ? "Reopen" : "Mark resolved"}
            className={cn(
              "rounded-lg p-1.5 transition-colors disabled:opacity-50",
              entry.resolved
                ? "text-amber-600 hover:bg-amber-50"
                : "text-green-600 hover:bg-green-50"
            )}
          >
            {entry.resolved ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span className="sr-only">{entry.resolved ? "Reopen" : "Mark resolved"}</span>
          </button>
          <button
            disabled={busyId === entry.id}
            onClick={() => deleteEntry(entry.id)}
            title="Delete"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Log</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and resolve runtime errors across the platform to keep it running smoothly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Unresolved</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">{stats.unresolved}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Fatal (open)</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{stats.fatal}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{stats.resolved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search message or path..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="Unresolved">Unresolved</option>
            <option value="Resolved">Resolved</option>
            <option value="All">All Statuses</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="All">All Severities</option>
            <option value="fatal">Fatal</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="All">All Sources</option>
            <option value="api">API</option>
            <option value="server">Server</option>
            <option value="client">Client</option>
            <option value="cron">Cron</option>
          </select>
          <Button variant="outline" size="sm" className="ml-auto" onClick={clearResolved}>
            <Trash2 className="h-4 w-4" />
            Clear Resolved
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(entry) => entry.id}
        ariaLabel="Error log"
        rowClassName={(entry) => (entry.resolved ? "opacity-60" : undefined)}
        renderExpanded={(entry) => (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              {entry.statusCode != null && <span>Status: <strong className="text-gray-700">{entry.statusCode}</strong></span>}
              {entry.digest && <span>Digest: <code className="text-gray-700">{entry.digest}</code></span>}
              {entry.resolved && (
                <span className="text-green-600">
                  Resolved{entry.resolverName ? ` by ${entry.resolverName}` : ""}
                  {entry.resolvedAt ? ` on ${formatTimestamp(entry.resolvedAt)}` : ""}
                </span>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">Message</p>
              <pre className="overflow-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 whitespace-pre-wrap">{entry.message}</pre>
            </div>
            {entry.stack && (
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Stack Trace</p>
                <pre className="max-h-64 overflow-auto rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800 whitespace-pre-wrap">{entry.stack}</pre>
              </div>
            )}
            {entry.context && Object.keys(entry.context).length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Context</p>
                <pre className="overflow-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800">{JSON.stringify(entry.context, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
        emptyState={{
          icon: <CheckCircle2 className="h-10 w-10 text-green-500" aria-hidden="true" />,
          title: "No errors match the current filters.",
          description: "The platform is running smoothly.",
        }}
      />
    </div>
  );
}
