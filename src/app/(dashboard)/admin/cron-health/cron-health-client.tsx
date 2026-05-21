"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCcw } from "lucide-react";
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
            <div
              className={cn(
                "rounded-xl border p-5",
                data.status === "healthy"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              )}
            >
              <div className="flex items-center gap-2">
                {data.status === "healthy" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                )}
                <h2
                  className={cn(
                    "text-base font-semibold capitalize",
                    data.status === "healthy" ? "text-emerald-900" : "text-amber-900"
                  )}
                >
                  {data.status}
                </h2>
                <span className="ml-auto text-xs text-gray-500">
                  checked {formatRelative(data.checked_at)}
                </span>
              </div>
              {data.alerts.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-amber-900">
                  {data.alerts.map((alert, i) => (
                    <li key={i}>• {alert}</li>
                  ))}
                </ul>
              )}
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
                  {data.jobs.map((job) => (
                    <tr key={job.name}>
                      <td className="px-5 py-2 font-mono text-xs text-gray-700">{job.name}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
