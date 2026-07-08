"use client";

import { useState } from "react";
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

export default function AuditLogClient({ entries }: AuditLogClientProps) {
  const [dateFrom, setDateFrom] = useState("2026-03-10");
  const [dateTo, setDateTo] = useState("2026-03-16");
  const [userSearch, setUserSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [entityFilter, setEntityFilter] = useState("All");

  const filteredEntries = (() => {
    let result = entries.filter((entry) => {
      const matchesUser = !userSearch || entry.userName.toLowerCase().includes(userSearch.toLowerCase());
      const matchesAction = actionFilter === "All" || entry.action === actionFilter;
      const matchesEntity = entityFilter === "All" || entry.entityType === entityFilter;
      return matchesUser && matchesAction && matchesEntity;
    });
    if (dateFrom) {
      result = result.filter(e => e.timestamp >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(e => e.timestamp <= dateTo + " 23:59:59");
    }
    return result;
  })();

  const handleExportLog = () => {
    const dataToExport = filteredEntries.map(entry => ({
      Timestamp: entry.timestamp,
      User: entry.userName,
      Action: entry.action,
      "Entity Type": entry.entityType,
      "Entity Name": entry.entityName,
      "IP Address": entry.ipAddress,
      Description: entry.description,
    }));
    exportCSV(dataToExport, `audit_log_${dateFrom}_to_${dateTo}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">Track all platform activities and changes</p>
        </div>
        <Button variant="outline" onClick={handleExportLog} disabled={filteredEntries.length === 0}>
          <Download className="h-4 w-4" />
          Export Log
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            <span className="text-sm text-gray-500">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search user..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          </div>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
            <option value="All">All Actions</option>
            <option value="Created">Created</option>
            <option value="Updated">Updated</option>
            <option value="Deleted">Deleted</option>
            <option value="Login">Login</option>
            <option value="Export">Export</option>
          </select>
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
            <option value="All">All Entities</option>
            <option value="User">User</option>
            <option value="Course">Course</option>
            <option value="Enrollment">Enrollment</option>
            <option value="Assessment">Assessment</option>
            <option value="Settings">Settings</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredEntries}
        rowKey={(entry) => entry.id}
        pageSize={15}
        ariaLabel="Audit log"
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
          description: "Try widening the date range or clearing the filters.",
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
    sortValue: (e) => e.userName,
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
