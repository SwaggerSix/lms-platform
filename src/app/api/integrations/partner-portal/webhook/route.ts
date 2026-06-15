import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { partnerPortalClient } from "@/lib/integrations/partner-portal/client";
import { upsertInstructor, EXTERNAL_SOURCE } from "@/lib/integrations/partner-portal/sync";
import type { PartnerPortalConfig } from "@/lib/integrations/partner-portal/types";

// Real-time ingest: the partner portal POSTs here (via a Postgres pg_net
// trigger) whenever a subcontractor profile changes. The payload is minimal
// — just the profile id — so we fetch the canonical profile back from the
// portal read API and upsert it. The scheduled cron (partner-portal-sync)
// reconciles anything a push missed.
export const dynamic = "force-dynamic";

/** Timing-safe check of the shared webhook secret presented as a Bearer token. */
function verifyWebhookSecret(provided: string | null): boolean {
  const secret = process.env.PARTNER_PORTAL_WEBHOOK_SECRET;
  if (!secret || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!verifyWebhookSecret(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { profile_id?: string; event?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileId = body.profile_id;
  if (!profileId) {
    return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: integration } = await service
    .from("external_integrations")
    .select("id, config, is_active")
    .eq("provider", EXTERNAL_SOURCE)
    .eq("is_active", true)
    .maybeSingle();

  if (!integration) {
    return NextResponse.json(
      { error: "Partner portal integration not configured" },
      { status: 503 }
    );
  }

  try {
    const instructor = await partnerPortalClient.fetchInstructor(
      integration.config as PartnerPortalConfig,
      profileId
    );
    if (!instructor) {
      // Profile is no longer a syncable subcontractor (deleted/hidden). The
      // reconcile leaves existing rows as-is; nothing to do here.
      return NextResponse.json({ message: "skipped: profile not found in portal", profile_id: profileId });
    }

    const { created } = await upsertInstructor(service, instructor, integration.id);
    return NextResponse.json({ message: created ? "created" : "updated", profile_id: profileId });
  } catch (err) {
    console.error("[partner-portal webhook]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
