import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logError, type ErrorSeverity } from "@/lib/error-log";
import { logAudit } from "@/lib/audit";

// GET /api/error-logs — list error logs (admin only)
export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const resolved = searchParams.get("resolved"); // "true" | "false" | null
  const severity = searchParams.get("severity");
  const source = searchParams.get("source");
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 1000);

  const service = createServiceClient();
  let query = service
    .from("error_logs")
    .select("*, resolver:users!resolved_by(id, first_name, last_name, email)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (resolved === "true") query = query.eq("resolved", true);
  if (resolved === "false") query = query.eq("resolved", false);
  if (severity) query = query.eq("severity", severity);
  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to load error logs" }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}

// POST /api/error-logs — report a client-side error (any authenticated user)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    message?: string;
    stack?: string;
    digest?: string;
    path?: string;
    severity?: ErrorSeverity;
    context?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "Missing error message" }, { status: 400 });
  }

  // Resolve the internal user id (best-effort) for attribution.
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  // Reconstruct an Error so stack is preserved through the logger.
  const err = new Error(body.message);
  if (body.stack) err.stack = body.stack;

  await logError({
    error: err,
    source: "client",
    severity: body.severity ?? "error",
    path: body.path,
    digest: body.digest,
    context: body.context,
    userId: dbUser?.id,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true });
}

// PATCH /api/error-logs — mark an error resolved/unresolved (admin only)
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { id?: string; resolved?: boolean; resolutionNotes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || typeof body.resolved !== "boolean") {
    return NextResponse.json({ error: "Missing id or resolved flag" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("error_logs")
    .update({
      resolved: body.resolved,
      resolved_at: body.resolved ? new Date().toISOString() : null,
      resolved_by: body.resolved ? auth.user.id : null,
      resolution_notes: body.resolutionNotes ?? null,
    })
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update error log" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: body.resolved ? "resolved" : "reopened",
    entityType: "error_log",
    entityId: body.id,
  });

  return NextResponse.json({ log: data });
}

// DELETE /api/error-logs?scope=resolved — clear resolved errors (admin only)
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const id = searchParams.get("id");

  const service = createServiceClient();

  if (id) {
    const { error } = await service.from("error_logs").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  } else if (scope === "resolved") {
    const { error } = await service.from("error_logs").delete().eq("resolved", true);
    if (error) return NextResponse.json({ error: "Failed to clear" }, { status: 500 });
  } else {
    return NextResponse.json({ error: "Specify id or scope=resolved" }, { status: 400 });
  }

  logAudit({
    userId: auth.user.id,
    action: "deleted",
    entityType: "error_log",
    entityId: id ?? "resolved",
  });

  return NextResponse.json({ ok: true });
}
