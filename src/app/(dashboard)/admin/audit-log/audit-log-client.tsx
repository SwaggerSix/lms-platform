"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Download, Calendar } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

export interface AuditEntry {
  id: string;
  timestamp: string;
  userName: string;
  userAvatar: string;
  action: "Created" | "Updated" | "Deleted" | "Login" | "Export" | "System";
  entityType: string;
  entityName: string;
  ipAddress: string;
  description: string;
  details?: { oldValue?: Record<string, string>; newValue?: Record<string, string> };
}

export interface AuditLogClientProps {
  entries: AuditEntry[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  sort?: string;
}

const actionColors: Record<string, string> = {
  Created: "bg-green-100 text-green-700",
  Updated: "bg-blue-100 text-blue-700",
  Deleted: "bg-red-100 text-red-700",
  Login: "bg-purple-100 text-purple-700",
  Export: "bg-amber-100 text-amber-700",
  System: "bg-gray-100 text-gray-600",
};

const exportCSV = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function AuditLogClient({
  entries,
  totalCount = 0,
  page = 1,
  pageSize = 25,
  sort = "-timestamp",
}: AuditLogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL is the source of truth for search/filter/sort/page; every change
  // pushes new params and the server refetches that page.
  const updateParams = (patch: Record<string, string | null>, resetPage = true) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (resetPage && !("page" in patch)) params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const sortKey = sort.replace(/^-/, "");
  const sortDesc = sort.startsWith("-");
  const toggleSort = (key: string) => {
    const next = sortKey === key ? (sortDesc ? key : `-${key}`) : key;
    updateParams({ sort: next });
  };

  // Filters live in the URL (server-authoritative). Search has a local mirror
  // so typing is smooth, then debounces into the URL.
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const actionFilter = searchParams.get("action") ?? "";
  const entityFilter = searchParams.get("entity") ?? "";
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const searchInitialized = useRef(false);
  useEffect(() => {
    // Skip the mount pass so we don't immediately re-push the current query.
    if (!searchInitialized.current) {
      searchInitialized.current = true;
      return;
    }
    const handle = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (searchInput !== current) updateParams({ q: searchInput || null });
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const handleExportLog = () => {
    const dataToExport = entries.map(entry => ({
      Timestamp: entry.timestamp,
      User: entry.userName,
      Action: entry.action,
      "Entity Type": entry.entityType,
      "Entity Name": entry.entityName,
      "IP Address": entry.ipAddress,
      Description: entry.description,
    }));
    exportCSV(dataToExport, `audit_log_page_${page}.csv`);
  };

  const hasActiveQuery = !!(searchInput || actionFilter || entityFilter || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">Track all platform activities and changes</p>
        </div>
        <Button variant="outline" onClick={handleExportLog} disabled={entries.length === 0}>
          <Download className="h-4 w-4" />
          Export Page
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => updateParams({ from: e.target.value || null })}
              aria-label="From date"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => updateParams({ to: e.target.value || null })}
              aria-label="To date"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search user..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => updateParams({ action: e.target.value || null })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="login">Login</option>
            <option value="export">Export</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => updateParams({ entity: e.target.value || null })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Entities</option>
            <option value="user">User</option>
            <option value="course">Course</option>
            <option value="enrollment">Enrollment</option>
            <option value="assessment">Assessment</option>
            <option value="settings">Settings</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={entries}
        rowKey={(entry) => entry.id}
        ariaLabel="Audit log"
        serverMode={{
          page,
          pageSize,
          total: totalCount,
          onPageChange: (p) => updateParams({ page: String(p) }),
          sort,
          onSortChange: toggleSort,
        }}
        isExpandable={(entry) => !!entry.details}
        renderExpanded={(entry) => (
          <div className="flex gap-6">
            {entry.details?.oldValue && (
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-600 mb-2">Old Values</p>
                <pre className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-800 overflow-auto">{JSON.stringify(entry.details.oldValue, null, 2)}</pre>
              </div>
            )}
            {entry.details?.newValue && (
              <div className="flex-1">
                <p className="text-xs font-semibold text-green-600 mb-2">New Values</p>
                <pre className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800 overflow-auto">{JSON.stringify(entry.details.newValue, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
        emptyState={{
          title: "No audit activity found",
          description: hasActiveQuery
            ? "Try widening the date range or clearing the filters."
            : "Platform activity appears here as it happens.",
        }}
      />
    </div>
  );
}

const columns: DataTableColumn<AuditEntry>[] = [
  {
    key: "timestamp",
    header: "Timestamp",
    sortValue: (e) => e.timestamp,
    render: (entry) => <span className="text-sm text-gray-500 whitespace-nowrap">{entry.timestamp}</span>,
  },
  {
    key: "user",
    header: "User",
    render: (entry) => (
      <div className="flex items-center gap-2">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white", entry.userName === "System" ? "bg-gray-400" : "bg-primary-500")}>{entry.userAvatar}</div>
        <span className="text-sm font-medium text-gray-900">{entry.userName}</span>
      </div>
    ),
  },
  {
    key: "action",
    header: "Action",
    sortValue: (e) => e.action,
    render: (entry) => (
      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", actionColors[entry.action])}>{entry.action}</span>
    ),
  },
  {
    key: "entityType",
    header: "Entity Type",
    sortValue: (e) => e.entityType,
    render: (entry) => <span className="text-sm text-gray-600">{entry.entityType}</span>,
  },
  {
    key: "entityName",
    header: "Entity Name",
    sortValue: (e) => e.entityName,
    render: (entry) => <span className="text-sm text-gray-900 font-medium">{entry.entityName}</span>,
  },
  {
    key: "ipAddress",
    header: "IP Address",
    render: (entry) => <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{entry.ipAddress}</code>,
  },
];
