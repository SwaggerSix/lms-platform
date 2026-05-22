import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTenantScope } from "@/lib/tenants/tenant-queries";
import { jsonCached } from "@/lib/api/cached";
import { jsonNoStore } from "@/lib/api/no-store";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  const tenantScope = profile ? await getTenantScope(profile.id, profile.role, request) : null;

  // Filter out retired rows: their data lives on the linked course's
  // metadata.required_for blob and is read from there instead.
  let query = service
    .from("compliance_requirements")
    .select("*")
    .is("retired_at", null)
    .order("created_at", { ascending: false });

  if (tenantScope) {
    query = query.in("course_id", tenantScope.courseIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Compliance API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return jsonCached(data);
}

/**
 * POST is permanently retired. New required-training records are
 * configured via courses.metadata.required_for from
 * /admin/courses → Required Training. The legacy compliance_requirements
 * table has been backfilled and is on its way to being dropped — no
 * new rows should be written to it.
 *
 * Returns 410 Gone with a Sunset/Link header pointing to the successor
 * path so any lingering integrations get a machine-readable redirect.
 * The PATCH and GET branches stay live during the read-cutover window
 * and will follow once all callers are flipped.
 */
export async function POST() {
  return jsonNoStore(
    {
      error: "Endpoint retired. Configure required training via /admin/courses (Required Training section).",
      successor: "/admin/courses",
    },
    {
      status: 410,
      headers: {
        Deprecation: "true",
        // RFC 8594 Sunset header: a fixed past date signals the
        // sunset is already complete.
        Sunset: "Wed, 01 Jan 2026 00:00:00 GMT",
        Link: '</admin/courses>; rel="successor-version"',
      },
    }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return jsonNoStore({ error: "Compliance requirement id is required" }, { status: 400 });
  }

  const allowedFields = ["name", "description", "regulation", "course_id", "path_id", "frequency_months", "applicable_roles", "applicable_org_ids", "is_mandatory"] as const;
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const { data, error } = await service
    .from("compliance_requirements")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Compliance API error:", error.message);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }
  return jsonNoStore(data);
}
