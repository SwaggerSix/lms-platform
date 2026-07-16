import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

const VALID_CHANNELS = ["in_app", "email", "push"] as const;

/**
 * GET /api/admin/notification-templates
 * Returns the organization's templates, falling back to the global defaults
 * (organization_id IS NULL) when the org has not customized any.
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const orgId = auth.user.organization_id;

  if (orgId) {
    const { data: orgRows, error: orgErr } = await service
      .from("notification_templates")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (orgErr) {
      console.error("Notification templates API error:", orgErr.message);
      return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
    }
    if (orgRows && orgRows.length > 0) {
      return NextResponse.json({ templates: orgRows });
    }
  }

  const { data, error } = await service
    .from("notification_templates")
    .select("*")
    .is("organization_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Notification templates API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
}

/**
 * POST /api/admin/notification-templates
 * Create a template in the caller's organization.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const channel = VALID_CHANNELS.includes(body.channel) ? body.channel : "in_app";

  const service = createServiceClient();
  const { data, error } = await service
    .from("notification_templates")
    .insert({
      organization_id: auth.user.organization_id ?? null,
      key: typeof body.key === "string" && body.key.trim() ? body.key.trim() : null,
      name,
      description: typeof body.description === "string" ? body.description : "",
      subject: typeof body.subject === "string" ? body.subject : null,
      body: typeof body.body === "string" ? body.body : "",
      channel,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Notification templates API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "created",
    entityType: "notification_template",
    entityId: data.id,
    newValues: { name },
  });

  return NextResponse.json({ template: data }, { status: 201 });
}

/**
 * PATCH /api/admin/notification-templates
 * Update a template the caller's organization owns. A null org (single-tenant
 * today) may edit the global defaults; an org-bound admin only edits their own.
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") {
    if (!body.name.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    updates.name = body.name.trim();
  }
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.subject === "string") updates.subject = body.subject;
  if (typeof body.body === "string") updates.body = body.body;
  if (VALID_CHANNELS.includes(body.channel)) updates.channel = body.channel;
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

  const service = createServiceClient();
  let query = service.from("notification_templates").update(updates).eq("id", body.id);
  query = auth.user.organization_id
    ? query.eq("organization_id", auth.user.organization_id)
    : query.is("organization_id", null);

  const { data, error } = await query.select().single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    console.error("Notification templates API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "notification_template",
    entityId: body.id,
    newValues: updates,
  });

  return NextResponse.json({ template: data });
}

/**
 * DELETE /api/admin/notification-templates?id=...
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
  }

  const service = createServiceClient();
  let query = service.from("notification_templates").delete().eq("id", id);
  query = auth.user.organization_id
    ? query.eq("organization_id", auth.user.organization_id)
    : query.is("organization_id", null);

  const { error } = await query;
  if (error) {
    console.error("Notification templates API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "deleted",
    entityType: "notification_template",
    entityId: id,
  });

  return NextResponse.json({ success: true, deleted_id: id });
}
