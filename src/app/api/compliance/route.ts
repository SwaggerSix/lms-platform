import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await service
    .from("compliance_requirements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Compliance API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Compliance requirement id is required" }, { status: 400 });
  }

  const allowedFields = ["title", "description", "type", "required_for", "due_date", "status", "recurrence"] as const;
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}
