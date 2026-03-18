import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  const body = await request.json();
  const { id } = await params;

  // Mass assignment fix: whitelist allowed fields
  const allowedFields = ["first_name", "last_name", "email", "job_title", "role", "status", "organization_id", "manager_id", "preferences", "avatar_url"];
  const sanitized = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key))
  );

  const { data, error } = await service
    .from("users")
    .update(sanitized)
    .eq("id", id)
    .select("id, first_name, last_name, email, role, status, job_title, avatar_url, organization_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  const { id } = await params;

  const { data, error } = await service
    .from("users")
    .update({ status: "inactive", deactivated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "User deactivated successfully" });
}
