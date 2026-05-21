"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileWarning, Workflow, RefreshCcw } from "lucide-react";
import { cn } from "@/utils/cn";

interface RuleRow {
  id: string;
  rule_id: string;
  user_id: string;
  action_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface WorkflowRow {
  id: string;
  run_id: string;
  step_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface AuditResponse {
  page: { limit: number; offset: number };
  rules: {
    total: number | null;
    page_failures: number;
    affected_rules_in_page: { rule_id: string; failures: number; latest: string }[];
    top_affected_rules_all_time: { rule_id: string; failures: number; latest: string }[];
    aggregation_capped_at_5000: boolean;
    aggregation_query_error: string | null;
    rows: RuleRow[];
    query_error: string | null;
  };
  workflows: {
    total_failed_steps: number | null;
    page_failed_steps: number;
    check_constraint_in_page: number;
    rows: WorkflowRow[];
    query_error: string | null;
  };
  notes: string[];
}

const PAGE_SIZE = 50;

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AuditClient() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(0);

  const load = useCallback(async (off: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/notification-audit?limit=${PAGE_SIZE}&offset=${off}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AuditResponse;
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load audit");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(offset);
  }, [offset, load]);

  const ruleTotal = data?.rules.total ?? 0;
  const workflowTotal = data?.workflows.total_failed_steps ?? 0;
  const totalMax = Math.max(ruleTotal, workflowTotal);
  const hasNext = data ? offset + PAGE_SIZE < totalMax : false;
  const hasPrev = offset > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <FileWarning className="h-6 w-6 text-amber-600" />
              Notification Audit
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Historical <code className="rounded bg-gray-100 px-1 text-xs">send_notification</code>{" "}
              failures from automation rules and workflows. CHECK-constraint failures are highlighted —
              these were silently dropping notifications before the fix in this branch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/admin/notification-audit?format=csv"
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Download up to 5000 rule failures + workflow CHECK failures as CSV"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
            <button
              onClick={() => load(offset)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {data?.notes && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <ul className="space-y-1 text-sm text-indigo-900">
              {data.notes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        )}

        {/* Summary tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500">Rule failures (all-time)</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{ruleTotal.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500">action_type = send_notification, status = error</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500">Workflow step failures (all-time)</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{workflowTotal.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500">status = failed (any step type)</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs uppercase tracking-wider text-amber-700">CHECK constraint hits (this page)</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {data?.workflows.check_constraint_in_page ?? 0}
            </p>
            <p className="mt-1 text-xs text-amber-700">Workflow steps matching the type CHECK error</p>
          </div>
        </div>

        {/* Top affected rules (all-time) */}
        {data && data.rules.top_affected_rules_all_time.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Top affected rules (all-time, top 20)
              </h2>
              {data.rules.aggregation_capped_at_5000 && (
                <span className="text-xs text-amber-700">
                  Aggregation capped at 5000 rows — counts may be partial
                </span>
              )}
            </header>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-2 text-left">Rule ID</th>
                  <th className="px-5 py-2 text-left">Failures</th>
                  <th className="px-5 py-2 text-left">Latest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rules.top_affected_rules_all_time.map((r) => (
                  <tr key={r.rule_id}>
                    <td className="px-5 py-2 font-mono text-xs text-gray-700">{r.rule_id}</td>
                    <td className="px-5 py-2 text-gray-900">{r.failures}</td>
                    <td className="px-5 py-2 text-gray-500">{formatDate(r.latest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Affected rules summary */}
        {data && data.rules.affected_rules_in_page.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Affected rules (this page)</h2>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-2 text-left">Rule ID</th>
                  <th className="px-5 py-2 text-left">Failures</th>
                  <th className="px-5 py-2 text-left">Latest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rules.affected_rules_in_page.map((r) => (
                  <tr key={r.rule_id}>
                    <td className="px-5 py-2 font-mono text-xs text-gray-700">{r.rule_id}</td>
                    <td className="px-5 py-2 text-gray-900">{r.failures}</td>
                    <td className="px-5 py-2 text-gray-500">{formatDate(r.latest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Workflow CHECK rows */}
        {data && data.workflows.rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
              <Workflow className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-900">
                Workflow steps with CHECK-constraint errors
              </h2>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-2 text-left">Run / Step</th>
                  <th className="px-5 py-2 text-left">Error</th>
                  <th className="px-5 py-2 text-left">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.workflows.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-2 font-mono text-xs text-gray-700">
                      {r.run_id?.slice(0, 8) ?? "—"} / {r.step_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-5 py-2 text-xs text-gray-700">{r.error_message ?? "—"}</td>
                    <td className="px-5 py-2 text-gray-500">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {offset + 1}–{offset + (data?.rules.page_failures ?? 0)} of {ruleTotal.toLocaleString()} rule failures
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={!hasPrev || loading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasNext || loading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
