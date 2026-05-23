"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { FuzzyCombobox } from "@/components/ui/fuzzy-combobox";

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
  /** When tenant_id IS NULL on the source row, this is a platform-level event (cron, super_admin action). */
  isPlatform?: boolean;
  /** Acting user's organization_id, when known. Null for system/platform rows or users without an org. */
  userOrganizationId?: string | null;
  /** Display name of the acting user's organization, for the filter dropdown. */
  userOrganizationName?: string | null;
}

export interface AuditLogClientProps {
  entries: AuditEntry[];
  initialHidePlatform?: boolean;
  initialEntityFilter?: string;
  initialOrgFilter?: string;
  initialActionFilter?: string;
  /** Server-side cap on the rows fetched; when totalRowCount exceeds this, the UI warns the admin to narrow filters. */
  rowLimit?: number;
  /** Exact row count from the audit_logs query (with the same tenant filter applied). May exceed rowLimit. */
  totalRowCount?: number;
  /** Resolved tenant scope for the current view (from resolveAuditLogTenant). Forwarded as x-tenant-id on the namespaces fetch so its counts match the visible rows. */
  scopedTenantId?: string | null;
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
  initialHidePlatform = false,
  initialEntityFilter = "All",
  initialOrgFilter = "All",
  initialActionFilter = "All",
  rowLimit,
  totalRowCount,
  scopedTenantId,
}: AuditLogClientProps) {
  const truncated =
    rowLimit != null && totalRowCount != null && totalRowCount > rowLimit;
  const [dateFrom, setDateFrom] = useState("2026-03-10");
  const [dateTo, setDateTo] = useState("2026-03-16");
  const [userSearch, setUserSearch] = useState("");
  const [actionFilter, setActionFilter] = useState(initialActionFilter);
  const [remoteNamespaces, setRemoteNamespaces] = useState<
    Array<{ prefix: string; count: number; parent?: string | null }>
  >([]);
  const [entityFilter, setEntityFilter] = useState(initialEntityFilter);
  const [orgFilter, setOrgFilter] = useState(initialOrgFilter);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [hidePlatform, setHidePlatform] = useState(initialHidePlatform);

  // Fetch the global namespace list whenever the hide-platform toggle
  // flips. The endpoint now accepts ?hide_platform=true so the returned
  // counts reflect only tenant-scoped activity — accurate either way.
  useEffect(() => {
    const qs = initialHidePlatform || hidePlatform ? "?hide_platform=true" : "";
    // Forward the page's resolved tenant via x-tenant-id so the
    // namespaces endpoint scopes its counts to the same rows the
    // table renders. Endpoint silently ignores a malformed header,
    // so we don't have to guard here.
    const headers: HeadersInit = scopedTenantId ? { "x-tenant-id": scopedTenantId } : {};
    fetch(`/api/admin/audit-log-namespaces${qs}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.namespaces) setRemoteNamespaces(json.namespaces);
      })
      .catch(() => {});
    // hidePlatform is read inside but we want to re-fetch on every toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidePlatform]);

  // Discover namespace prefixes from on-page entries as a fallback. Merge
  // with the server-side list so the dropdown stays useful even if the
  // namespaces endpoint is unavailable.
  //
  // When hidePlatform is on, the on-page bucket counts only non-platform
  // entries. The remote (server-side) counts are global and can't be
  // safely scoped without a dedicated endpoint, so we suppress the remote
  // contribution entirely under hidePlatform — keeps the visible counts
  // honest at the cost of dropping prefixes whose only on-page evidence
  // was platform rows. Acceptable tradeoff for "I only want to see my
  // own tenant".
  const dynamicNamespaces = useMemo(() => {
    const counts = new Map<string, number>();
    const considered = hidePlatform ? entries.filter((e) => !e.isPlatform) : entries;
    for (const e of considered) {
      const dot = e.action.indexOf(".");
      if (dot <= 0) continue;
      const prefix = e.action.slice(0, dot).toLowerCase();
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
    if (!hidePlatform) {
      for (const ns of remoteNamespaces) {
        // Prefer the higher count between local sample and server-side total.
        const existing = counts.get(ns.prefix) ?? 0;
        counts.set(ns.prefix, Math.max(existing, ns.count));
      }
    }
    return Array.from(counts.entries())
      .filter(([prefix]) => !["created", "updated", "deleted", "login", "export"].includes(prefix))
      .sort((a, b) => b[1] - a[1]);
  }, [entries, remoteNamespaces, hidePlatform]);

  // Build the set of organizations represented in the current entry
  // sample, so the dropdown reflects what's actually filterable. "None"
  // is added when at least one entry has no org (system/platform rows
  // or users without an organization_id) so admins can narrow to those.
  const orgOptions = useMemo(() => {
    const byId = new Map<string, string>();
    let hasUnassigned = false;
    for (const e of entries) {
      if (e.userOrganizationId) {
        byId.set(e.userOrganizationId, e.userOrganizationName ?? "(unnamed org)");
      } else {
        hasUnassigned = true;
      }
    }
    const opts = Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { opts, hasUnassigned };
  }, [entries]);

  // Persist a single audit_filters prefs blob so the entity + org
  // selections stick across sessions alongside hide_platform_audit.
  // Fire-and-forget — UI doesn't block on the save. Each call sends only
  // the changed key under audit_filters; the server-side PATCH merges
  // partial preferences into the existing blob.
  const persistAuditPref = (patch: Record<string, unknown>) => {
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferences: { ui_prefs: patch },
      }),
    }).catch(() => {});
  };
  const persistHidePlatform = (next: boolean) =>
    persistAuditPref({ hide_platform_audit: next });
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
      // "Export" category covers both the literal "Export" action and any
      // newer dotted-namespace action that starts with "export." (e.g.
      // "export.notification_audit_csv"). Same idea would apply to future
      // namespaces like "refresh." — generalized via lowercase prefix match.
      // Treat blank / whitespace-only filter as "All" so a stray space
      // from an external setter or a paste glitch doesn't accidentally
      // hide every row.
      const trimmedFilter = actionFilter.trim();
      const effectiveFilter = trimmedFilter === "" ? "All" : trimmedFilter;
      const filterLower = effectiveFilter.toLowerCase();
      const actionLower = entry.action.toLowerCase();
      const matchesAction =
        effectiveFilter === "All" ||
        entry.action === effectiveFilter ||
        actionLower.startsWith(`${filterLower}.`);
      const matchesEntity = entityFilter === "All" || entry.entityType === entityFilter;
      // Org filter narrows to rows whose acting user belongs to the
      // selected organization. "None" matches rows with no org
      // (system events, users without an organization_id).
      const matchesOrg =
        orgFilter === "All" ||
        (orgFilter === "None" && !entry.userOrganizationId) ||
        entry.userOrganizationId === orgFilter;
      return matchesUser && matchesAction && matchesEntity && matchesOrg;
    });
    if (dateFrom) {
      result = result.filter(e => e.timestamp >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(e => e.timestamp <= dateTo + " 23:59:59");
    }
    if (hidePlatform) {
      result = result.filter(e => !e.isPlatform);
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

      {truncated && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
        >
          Showing {rowLimit?.toLocaleString()} of {totalRowCount?.toLocaleString()} rows.
          Narrow the date range or other filters to see older activity — the export reflects only
          the rows currently loaded.
        </div>
      )}

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
          {/* Action filter: fuzzy-matching combobox. Lets admins either
              type a partial namespace ("repl") to narrow suggestions
              with subsequence matching, or paste an exact action like
              "replay.cron_alerts.compliance-recurrence". The downstream
              filter logic (exact + dotted-prefix match) handles both. */}
          <FuzzyCombobox
            value={actionFilter === "All" ? "" : actionFilter}
            onChange={(next) => {
              const norm = next.trim();
              const value = norm || "All";
              setActionFilter(value);
              setCurrentPage(1);
              persistAuditPref({ action_filter: value });
            }}
            placeholder="All actions — type to filter…"
            ariaLabel="Filter by action"
            className="min-w-[16rem]"
            suggestions={(() => {
              const commonValues = new Set(["profile.preferences", "refresh", "replay"]);
              return [
                { value: "Created" },
                { value: "Updated" },
                { value: "Deleted" },
                { value: "Login" },
                { value: "Export" },
                { value: "profile.preferences", label: "Preference Changes" },
                { value: "refresh", label: "View Refreshes" },
                { value: "replay", label: "Replays" },
                ...dynamicNamespaces
                  .filter(([p]) => !["profile", "refresh", "replay"].includes(p))
                  .map(([prefix, count]) => ({
                    value: prefix,
                    meta: `${count} rows`,
                  })),
                ...remoteNamespaces
                  .filter(
                    (n) =>
                      n.parent &&
                      !["created", "updated", "deleted", "login", "export"].includes(n.parent) &&
                      !commonValues.has(n.prefix)
                  )
                  .map((n) => ({
                    value: n.prefix,
                    meta: `${n.count} rows`,
                  })),
              ];
            })()}
          />
          <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setCurrentPage(1); persistAuditPref({ entity_filter: e.target.value }); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="All">All Entities</option>
            <option value="User">User</option>
            <option value="Course">Course</option>
            <option value="Enrollment">Enrollment</option>
            <option value="Assessment">Assessment</option>
            <option value="Settings">Settings</option>
          </select>
          <select
            value={orgFilter}
            onChange={(e) => { setOrgFilter(e.target.value); setCurrentPage(1); persistAuditPref({ org_filter: e.target.value }); }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            aria-label="Filter by organization"
          >
            <option value="All">All Organizations</option>
            {orgOptions.hasUnassigned && <option value="None">(No organization)</option>}
            {orgOptions.opts.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={hidePlatform}
              onChange={(e) => {
                setHidePlatform(e.target.checked);
                setCurrentPage(1);
                persistHidePlatform(e.target.checked);
              }}
              className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Hide platform events
          </label>
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
                      <div className="flex items-center gap-1.5">
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", actionColors[entry.action])}>{entry.action}</span>
                        {entry.isPlatform && (
                          <span
                            className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
                            title="Platform-level event (cron run, super_admin action, or system insert). Visible to all admins."
                          >
                            Platform
                          </span>
                        )}
                      </div>
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
