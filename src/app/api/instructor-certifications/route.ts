import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

const STAFF = ["admin", "super_admin", "manager"];
const FIELDS = ["name", "credential_type", "license_number", "issuing_body", "issuing_state", "issued_date", "expiry_date", "status", "notes"] as const;

/**
 * GET /api/instructor-certifications
 *   ?scope=all  → staff: every instructor's certifications (with names)
 *   ?user_id=X  → that user's certifications (self, or staff)
 *   (default)   → the caller's own certifications
 */
export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const isStaff = STAFF.includes(auth.user.role);

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const userId = searchParams.get("user_id");

  const service = createServiceClient();
  let query = service
    .from("instructor_certifications")
    .select("*, user:users(first_name, last_name, email)")
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (scope === "all") {
    if (!isStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    const target = userId && isStaff ? userId : auth.user.id;
    query = query.eq("user_id", target);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Instructor certs GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ certifications: data ?? [] });
}

/** POST — create a certification for self (or any user, staff only). */
export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const isStaff = STAFF.includes(auth.user.role);

  const body = await request.json();
  if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const targetUser = body.user_id && isStaff ? body.user_id : auth.user.id;
  const insert: Record<string, unknown> = { user_id: targetUser };
  for (const f of FIELDS) if (body[f] !== undefined) insert[f] = body[f] || null;
  insert.name = body.name;

  const service = createServiceClient();
  const { data, error } = await service.from("instructor_certifications").insert(insert).select().single();
  if (error) {
    console.error("Instructor certs POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ certification: data }, { status: 201 });
}

/** PATCH — update a certification (owner or staff). */
export async function PATCH(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const isStaff = STAFF.includes(auth.user.role);

  const body = await request.json();
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const service = createServiceClient();
  const { data: existing } = await service.from("instructor_certifications").select("user_id").eq("id", body.id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isStaff && existing.user_id !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (body[f] !== undefined) updates[f] = body[f] || null;

  const { data, error } = await service.from("instructor_certifications").update(updates).eq("id", body.id).select().single();
  if (error) {
    console.error("Instructor certs PATCH error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ certification: data });
}

/** DELETE ?id= — owner or staff. */
export async function DELETE(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const isStaff = STAFF.includes(auth.user.role);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const service = createServiceClient();
  const { data: existing } = await service.from("instructor_certifications").select("user_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isStaff && existing.user_id !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await service.from("instructor_certifications").delete().eq("id", id);
  if (error) {
    console.error("Instructor certs DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
