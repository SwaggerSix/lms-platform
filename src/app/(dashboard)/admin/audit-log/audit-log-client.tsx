"use client";

import { Fragment, useState } from "react";
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
} from "lucide-react";
import { cn } from "@/utils/cn";

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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
        <button onClick={handleExportLog} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
          <Download className="h-4 w-4" />
          Export Log
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <span className="text-sm text-gray-500">to</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search user..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="All">All Actions</option>
            <option value="Created">Created</option>
            <option value="Updated">Updated</option>
            <option value="Deleted">Deleted</option>
            <option value="Login">Login</option>
            <option value="Export">Export</option>
          </select>
          <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="All">All Entities</option>
            <option value="User">User</option>
            <option value="Course">Course</option>
            <option value="Enrollment">Enrollment</option>
            <option value="Assessment">Assessment</option>
            <option value="Settings">Settings</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-8 px-4 py-3" />
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entity Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entity Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedEntries.map((entry) => {
              const isExpanded = expandedRows.has(entry.id);
              return (
                <Fragment key={entry.id}>
                  <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => entry.details && toggleRow(entry.id)}>
                    <td className="px-4 py-3">
                      {entry.details ? (
                        isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />
                      ) : <span className="w-4" />}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{entry.timestamp}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white", entry.userName === "System" ? "bg-gray-400" : "bg-indigo-500")}>{entry.userAvatar}</div>
                        <span className="text-sm font-medium text-gray-900">{entry.userName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", actionColors[entry.action])}>{entry.action}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.entityType}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{entry.entityName}</td>
                    <td className="px-4 py-3"><code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{entry.ipAddress}</code></td>
                  </tr>
                  {isExpanded && entry.details && (
                    <tr className="bg-gray-50/50">
                      <td colSpan={7} className="px-8 py-4">
                        <div className="flex gap-6">
                          {entry.details.oldValue && (
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-red-600 mb-2">Old Values</p>
                              <pre className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-800 overflow-auto">{JSON.stringify(entry.details.oldValue, null, 2)}</pre>
                            </div>
                          )}
                          {entry.details.newValue && (
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-green-600 mb-2">New Values</p>
                              <pre className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800 overflow-auto">{JSON.stringify(entry.details.newValue, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
          <p className="text-sm text-gray-500">
            Showing {filteredEntries.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredEntries.length)} of {filteredEntries.length} results
          </p>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .reduce<(number | string)[]>((acc, page, idx, arr) => {
                if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) =>
                typeof item === "string" ? (
                  <span key={`ellipsis-${idx}`} className="text-gray-500">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium",
                      currentPage === item
                        ? "bg-indigo-600 text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                    )}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
