import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

interface JobSummary {
  job: string;
  count: number;
  success_rate: number | null;
  p50_duration_ms: number | null;
  p95_duration_ms: number | null;
  runs: Array<{
    id: string;
    job_name: string;
    status: string;
    duration_ms: number | null;
    records_processed: number | null;
    error_message: string | null;
    created_at: string;
  }>;
}

/**
 * GET /api/cron/history
 *
 * Single-job: ?job=<name>&limit=50 — returns one JobSummary.
 * Batch:      ?jobs=<a,b,c>&limit=50 — returns { jobs: Record<name, JobSummary> }.
 * CSV:        ?job=<name>&format=csv — single-job only, returns text/csv.
 *
 * Batch mode lets the cron-health page fetch sparkline data for every
 * cron in one round-trip instead of N parallel requests. Limit is capped
 * at 200 per job to keep response payload bounded.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const job = (url.searchParams.get("job") ?? "").trim();
  const jobsParam = (url.searchParams.get("jobs") ?? "").trim();
  const format = url.searchParams.get("format");
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));

  if (!job && !jobsParam) {
    return NextResponse.json({ error: "Missing 'job' or 'jobs' query parameter" }, { status: 400 });
  }
  if (jobsParam && format === "csv") {
    return NextResponse.json({ error: "format=csv requires single-job mode" }, { status: 400 });
  }

  const service = createServiceClient();

  // ── Single-job ───────────────────────────────────────────────
  if (job) {
    const { data, error } = await service
      .from("cron_runs")
      .select("id, job_name, status, duration_ms, records_processed, error_message, created_at")
      .eq("job_name", job)
      .order("created_at", { ascending: false })
      .limit(format === "csv" ? Math.min(1000, limit * 4) : limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (format === "csv") {
      const rows = (data ?? []) as any[];
      const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [
        ["created_at", "status", "duration_ms", "records_processed", "error_message"].map(escape).join(","),
        ...rows.map((r) =>
          [r.created_at, r.status, r.duration_ms ?? "", r.records_processed ?? "", r.error_message ?? ""]
            .map(escape)
            .join(",")
        ),
      ];
      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="cron-history-${job}-${new Date()
            .toISOString()
            .slice(0, 10)}.csv"`,
          // CSV is a downloadable artifact, not a polling target. A
          // short private cache lets a quick re-download (operator
          // refreshing while attaching to an incident) avoid the full
          // 5000-row query.
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      });
    }

    return NextResponse.json(summarize(job, data ?? []), {
      headers: {
        // Per-job history is read on-demand when a row is expanded.
        // 30s private cache keeps repeat expand-collapse cheap.
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  }

  // ── Batch ────────────────────────────────────────────────────
  const requested = jobsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (requested.length === 0) {
    return NextResponse.json({ error: "Empty 'jobs' list" }, { status: 400 });
  }
  if (requested.length > 32) {
    return NextResponse.json({ error: "Too many jobs (max 32)" }, { status: 400 });
  }

  // One round-trip via `in()` — then partition by job_name in JS.
  // Per-job limit is enforced after partitioning because PostgREST
  // doesn't support per-group LIMIT in a single query.
  const { data: rawRows, error: batchErr } = await service
    .from("cron_runs")
    .select("id, job_name, status, duration_ms, records_processed, error_message, created_at")
    .in("job_name", requested)
    .order("created_at", { ascending: false })
    .limit(limit * requested.length);

  if (batchErr) {
    return NextResponse.json({ error: batchErr.message }, { status: 500 });
  }

  const byJob: Record<string, any[]> = {};
  for (const r of (rawRows ?? []) as any[]) {
    const list = byJob[r.job_name] ?? [];
    if (list.length < limit) list.push(r);
    byJob[r.job_name] = list;
  }
  const out: Record<string, JobSummary> = {};
  for (const name of requested) {
    out[name] = summarize(name, byJob[name] ?? []);
  }

  return NextResponse.json(
    { jobs: out },
    {
      headers: {
        // Same TTL as single-job mode — the sparkline eager-prefetch
        // benefits from cache on tab refresh.
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}

function summarize(name: string, rows: any[]): JobSummary {
  // Caller passes rows in descending created_at; flip for trend charts.
  const ordered = rows.slice().reverse();
  const successes = ordered.filter((r) => r.status === "success").length;
  const durations = ordered
    .map((r) => Number(r.duration_ms))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  const pct = (p: number) => {
    if (durations.length === 0) return null;
    const idx = Math.min(durations.length - 1, Math.floor((durations.length - 1) * p));
    return durations[idx];
  };
  return {
    job: name,
    count: ordered.length,
    success_rate: ordered.length > 0 ? successes / ordered.length : null,
    p50_duration_ms: pct(0.5),
    p95_duration_ms: pct(0.95),
    runs: ordered,
  };
}
