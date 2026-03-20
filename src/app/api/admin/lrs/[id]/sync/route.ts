import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { LRSClient } from "@/lib/xapi/lrs-client";

/**
 * POST /api/admin/lrs/[id]/sync
 * Trigger a manual sync with an external LRS.
 * Supports: test connection, push unsent statements, or pull statements.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action || "test";

  const service = createServiceClient();

  // Fetch full config including secrets
  const { data: config, error: configError } = await service
    .from("lrs_configurations")
    .select("*")
    .eq("id", id)
    .single();

  if (configError || !config) {
    return NextResponse.json({ error: "LRS configuration not found" }, { status: 404 });
  }

  const client = new LRSClient({
    id: config.id,
    endpoint_url: config.endpoint_url,
    auth_type: config.auth_type,
    username: config.username,
    password_encrypted: config.password_encrypted,
    token_encrypted: config.token_encrypted,
  });

  // ─── Test Connection ───────────────────────────────────────────────────
  if (action === "test") {
    const result = await client.testConnection();
    return NextResponse.json(result);
  }

  // ─── Push Statements ──────────────────────────────────────────────────
  if (action === "push") {
    if (!["push", "both"].includes(config.sync_direction)) {
      return NextResponse.json(
        { error: "This LRS is not configured for push sync" },
        { status: 400 }
      );
    }

    // Get statements since last sync
    let query = service
      .from("xapi_statements")
      .select("raw_statement")
      .eq("voided", false)
      .order("stored_at", { ascending: true })
      .limit(100);

    if (config.last_sync_at) {
      query = query.gt("stored_at", config.last_sync_at);
    }

    const { data: statements, error: stmtError } = await query;

    if (stmtError) {
      return NextResponse.json({ error: "Failed to fetch statements" }, { status: 500 });
    }

    if (!statements || statements.length === 0) {
      return NextResponse.json({ message: "No new statements to sync", count: 0 });
    }

    let pushed = 0;
    let failed = 0;

    for (const stmt of statements) {
      if (!stmt.raw_statement) continue;
      try {
        await client.pushStatement(stmt.raw_statement as any);
        pushed++;
      } catch {
        failed++;
      }
    }

    // Update last_sync_at
    await service
      .from("lrs_configurations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      message: `Sync complete: ${pushed} pushed, ${failed} failed`,
      pushed,
      failed,
      total: statements.length,
    });
  }

  // ─── Pull Statements ──────────────────────────────────────────────────
  if (action === "pull") {
    if (!["pull", "both"].includes(config.sync_direction)) {
      return NextResponse.json(
        { error: "This LRS is not configured for pull sync" },
        { status: 400 }
      );
    }

    try {
      const result = await client.queryStatements({
        since: config.last_sync_at || undefined,
        limit: 100,
      });

      let imported = 0;
      for (const stmt of result.statements || []) {
        const verb = stmt.verb?.id || "";
        const objectId = "id" in (stmt.object || {}) ? (stmt.object as any).id : "";

        const { error: insertError } = await service
          .from("xapi_statements")
          .upsert(
            {
              statement_id: stmt.id || crypto.randomUUID(),
              actor_id: auth.user.id,
              verb,
              verb_display: stmt.verb?.display?.["en-US"] || null,
              object_type: "activity",
              object_id: objectId,
              object_name:
                "definition" in (stmt.object || {})
                  ? (stmt.object as any).definition?.name?.["en-US"] || null
                  : null,
              result_score_scaled: stmt.result?.score?.scaled ?? null,
              result_score_raw: stmt.result?.score?.raw ?? null,
              result_success: stmt.result?.success ?? null,
              result_completion: stmt.result?.completion ?? null,
              result_duration: stmt.result?.duration ?? null,
              timestamp: stmt.timestamp || new Date().toISOString(),
              raw_statement: stmt as unknown as Record<string, unknown>,
            },
            { onConflict: "statement_id" }
          );

        if (!insertError) imported++;
      }

      // Update last_sync_at
      await service
        .from("lrs_configurations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", id);

      return NextResponse.json({
        message: `Pull complete: ${imported} statements imported`,
        imported,
        total: result.statements?.length || 0,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Pull sync failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid action. Use: test, push, or pull" }, { status: 400 });
}
