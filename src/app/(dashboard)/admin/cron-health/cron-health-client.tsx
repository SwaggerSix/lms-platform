"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, Download, RefreshCcw } from "lucide-react";
import { cn } from "@/utils/cn";

interface CronJob {
  name: string;
  last_run: string;
  status: string;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  checked_at: string;
  jobs: CronJob[];
  alerts: string[];
  alert_count: number;
}

interface CronRun {
  id: string;
  job_name: string;
  status: "success" | "failure";
  duration_ms: number | null;
  records_processed: number | null;
  error_message: string | null;
  created_at: string;
}

interface HistoryResponse {
  job: string;
  count: number;
  success_rate: number | null;
  p50_duration_ms: number | null;
  p95_duration_ms: number | null;
  runs: CronRun[];
}

function formatMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatRelative(iso: string): string {
  if (!iso || iso === "never") return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CronHealthClient() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryResponse>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const loadHistory = useCallback(async (jobName: string) => {
    if (history[jobName]) return;
    setHistoryLoading(jobName);
    try {
      const res = await fetch(`/api/cron/history?job=${encodeURIComponent(jobName)}&limit=50`);
      if (!res.ok) return;
      const json = (await res.json()) as HistoryResponse;
      setHistory((prev) => ({ ...prev, [jobName]: json }));
    } finally {
      setHistoryLoading(null);
    }
  }, [history]);

  const toggle = useCallback((jobName: string) => {
    setExpanded((prev) => {
      const next = prev === jobName ? null : jobName;
      if (next) loadHistory(next);
      return next;
    });
  }, [loadHistory]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as HealthResponse;
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Eagerly prefetch a small history window for every job so the
  // sparkline tiles have something to render without a click. One
  // batched request via ?jobs=<comma-list> instead of N parallel ones.
  useEffect(() => {
    if (!data?.jobs || data.jobs.length === 0) return;
    const missing = data.jobs.filter((j) => !history[j.name]).map((j) => j.name);
    if (missing.length === 0) return;
    const qs = `jobs=${missing.map(encodeURIComponent).join(",")}&limit=20`;
    fetch(`/api/cron/history?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.jobs) {
          setHistory((prev) => ({ ...prev, ...json.jobs }));
        }
      })
      .catch(() => {});
  }, [data, history]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Clock className="h-6 w-6 text-indigo-600" />
              Cron Health
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Status and last-run timestamps for scheduled jobs. Data lives in{" "}
              <code className="rounded bg-gray-100 px-1 text-xs">cron_runs</code> and is updated
              by each cron via <code className="rounded bg-gray-100 px-1 text-xs">logCronRun</code>.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        )}

        {data && (
          <>
            {(() => {
              // Bucket alert strings by their [critical]/[warn] tag.
              // Alerts without an explicit tag (legacy / unrecognized) bucket
              // into "other" and render in the same warn-toned section.
              const critical = data.alerts.filter((a) => /\[critical\]/.test(a));
              const warn = data.alerts.filter((a) => /\[warn\]/.test(a));
              const other = data.alerts.filter(
                (a) => !/\[critical\]/.test(a) && !/\[warn\]/.test(a)
              );
              const hasCritical = critical.length > 0;
              return (
                <div
                  className={cn(
                    "rounded-xl border p-5",
                    data.status === "healthy"
                      ? "border-emerald-200 bg-emerald-50"
                      : hasCritical
                        ? "border-red-200 bg-red-50"
                        : "border-amber-200 bg-amber-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {data.status === "healthy" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    ) : (
                      <AlertTriangle
                        className={cn("h-5 w-5", hasCritical ? "text-red-700" : "text-amber-700")}
                      />
                    )}
                    <h2
                      className={cn(
                        "text-base font-semibold capitalize",
                        data.status === "healthy"
                          ? "text-emerald-900"
                          : hasCritical
                            ? "text-red-900"
                            : "text-amber-900"
                      )}
                    >
                      {data.status}
                    </h2>
                    {(critical.length > 0 || warn.length > 0 || other.length > 0) && (
                      <div className="flex items-center gap-1.5">
                        {critical.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 ring-1 ring-inset ring-red-200">
                            {critical.length} critical
                          </span>
                        )}
                        {warn.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 ring-1 ring-inset ring-amber-200">
                            {warn.length} warn
                          </span>
                        )}
                        {other.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700 ring-1 ring-inset ring-gray-200">
                            {other.length} other
                          </span>
                        )}
                      </div>
                    )}
                    <span className="ml-auto text-xs text-gray-500">
                      checked {formatRelative(data.checked_at)}
                    </span>
                  </div>
                  {data.alerts.length > 0 && (
                    <ul
                      className={cn(
                        "mt-3 space-y-1 text-sm",
                        hasCritical ? "text-red-900" : "text-amber-900"
                      )}
                    >
                      {[...critical, ...warn, ...other].map((alert, i) => (
                        <li key={i}>• {alert}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            {/* Sparkline tile grid — at-a-glance view of every job */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {data.jobs.map((job) => {
                const hist = history[job.name];
                const runs = hist?.runs ?? [];
                const maxD = Math.max(1, ...runs.map((r) => Number(r.duration_ms) || 0));
                const lastRunAgo = job.last_run === "never" ? "never" : formatRelative(job.last_run);
                return (
                  <button
                    key={`tile-${job.name}`}
                    type="button"
                    onClick={() => toggle(job.name)}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-gray-700">{job.name}</p>
                        <p className="mt-0.5 text-[10px] text-gray-500">last {lastRunAgo}</p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          job.status === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : job.status === "failure"
                              ? "bg-red-50 text-red-700"
                              : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-2 flex h-8 items-end gap-0.5">
                      {runs.length === 0 ? (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                          no history
                        </div>
                      ) : (
                        runs.map((r) => {
                          const d = Number(r.duration_ms) || 0;
                          const pct = (d / maxD) * 100;
                          return (
                            <div
                              key={r.id}
                              title={`${new Date(r.created_at).toLocaleString()} · ${r.status} · ${formatMs(d)}`}
                              className={cn(
                                "flex-1 min-w-[2px] rounded-sm",
                                r.status === "success" ? "bg-emerald-400" : "bg-red-400"
                              )}
                              style={{ height: `${Math.max(2, pct)}%` }}
                            />
                          );
                        })
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <header className="border-b border-gray-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Jobs</h2>
              </header>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-2 text-left">Name</th>
                    <th className="px-5 py-2 text-left">Last Run</th>
                    <th className="px-5 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.jobs.map((job) => {
                    const isOpen = expanded === job.name;
                    const hist = history[job.name];
                    const maxDuration = hist
                      ? Math.max(1, ...hist.runs.map((r) => Number(r.duration_ms) || 0))
                      : 0;
                    return (
                      <Fragment key={job.name}>
                        <tr
                          onClick={() => toggle(job.name)}
                          className="cursor-pointer hover:bg-gray-50"
                        >
                          <td className="px-5 py-2 font-mono text-xs text-gray-700">
                            <span className="inline-flex items-center gap-1">
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              {job.name}
                            </span>
                          </td>
                          <td className="px-5 py-2 text-gray-600">
                            {formatRelative(job.last_run)}
                            {job.last_run !== "never" && (
                              <span className="ml-2 text-xs text-gray-400">
                                ({new Date(job.last_run).toLocaleString()})
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                job.status === "success"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : job.status === "failure"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                              )}
                            >
                              {job.status}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={3} className="bg-gray-50/40 px-5 py-3">
                              {historyLoading === job.name ? (
                                <p className="text-xs text-gray-500">Loading history…</p>
                              ) : hist ? (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                                    <span>
                                      <strong>{hist.count}</strong> runs
                                    </span>
                                    <span>
                                      Success rate:{" "}
                                      <strong
                                        className={cn(
                                          (hist.success_rate ?? 0) >= 0.9
                                            ? "text-emerald-700"
                                            : (hist.success_rate ?? 0) >= 0.7
                                              ? "text-amber-700"
                                              : "text-red-700"
                                        )}
                                      >
                                        {hist.success_rate === null
                                          ? "—"
                                          : `${(hist.success_rate * 100).toFixed(1)}%`}
                                      </strong>
                                    </span>
                                    <span>
                                      p50: <strong>{formatMs(hist.p50_duration_ms)}</strong>
                                    </span>
                                    <span>
                                      p95: <strong>{formatMs(hist.p95_duration_ms)}</strong>
                                    </span>
                                    </div>
                                    <a
                                      href={`/api/cron/history?job=${encodeURIComponent(job.name)}&format=csv&limit=200`}
                                      download
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Export CSV
                                    </a>
                                  </div>
                                  {hist.runs.length > 0 && (
                                    <div>
                                      <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
                                        Duration trend (oldest → newest)
                                      </p>
                                      <div className="flex h-16 items-end gap-0.5 rounded border border-gray-200 bg-white p-1">
                                        {hist.runs.map((r) => {
                                          const d = Number(r.duration_ms) || 0;
                                          const pct = maxDuration > 0 ? (d / maxDuration) * 100 : 0;
                                          return (
                                            <div
                                              key={r.id}
                                              title={`${new Date(r.created_at).toLocaleString()} · ${r.status} · ${formatMs(d)}`}
                                              className={cn(
                                                "flex-1 min-w-[2px] rounded-sm transition-opacity hover:opacity-100 opacity-80",
                                                r.status === "success" ? "bg-emerald-400" : "bg-red-400"
                                              )}
                                              style={{ height: `${Math.max(2, pct)}%` }}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">No history yet.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
