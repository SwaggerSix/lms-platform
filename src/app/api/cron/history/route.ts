import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/history?job=<name>&limit=50
 *
 * Returns the last N cron_runs rows for a job, oldest first so charting
 * goes left-to-right. Limit is capped at 200 to keep response payload
 * sensible; the cron-health page uses 50 for a two-week-ish window of
 * daily jobs.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const job = (url.searchParams.get("job") ?? "").trim();
  const format = url.searchParams.get("format");
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));

  if (!job) {
    return NextResponse.json({ error: "Missing 'job' query parameter" }, { status: 400 });
  }

  const service = createServiceClient();
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
      },
    });
  }

  // Reverse so the response goes oldest → newest for trend charting.
  const ordered = (data ?? []).slice().reverse();

  // Summary stats: success rate, p50 / p95 duration.
  const successes = ordered.filter((r: any) => r.status === "success").length;
  const durations = ordered
    .map((r: any) => Number(r.duration_ms))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  const pct = (p: number) => {
    if (durations.length === 0) return null;
    const idx = Math.min(durations.length - 1, Math.floor((durations.length - 1) * p));
    return durations[idx];
  };

  return NextResponse.json({
    job,
    count: ordered.length,
    success_rate: ordered.length > 0 ? successes / ordered.length : null,
    p50_duration_ms: pct(0.5),
    p95_duration_ms: pct(0.95),
    runs: ordered,
  });
}
