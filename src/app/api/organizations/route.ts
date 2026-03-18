import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createOrgSchema } from "@/lib/validations";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await service
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Organizations API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  const body = await request.json();
  const validation = validateBody(createOrgSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Mass assignment fix: whitelist allowed fields
  const allowedPostFields = ["name", "description", "parent_id"];
  const sanitized = Object.fromEntries(
    Object.entries(validation.data).filter(([key]) => allowedPostFields.includes(key))
  );

  const { data, error } = await service
    .from("organizations")
    .insert(sanitized)
    .select()
    .single();

  if (error) {
    console.error("Organizations API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Organization id is required" }, { status: 400 });
  }

  // Mass assignment fix: whitelist allowed fields
  const allowedPatchFields = ["name", "description"];
  const sanitizedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedPatchFields.includes(key))
  );

  const { data, error } = await service
    .from("organizations")
    .update(sanitizedUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Organizations API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Organization id is required" }, { status: 400 });
  }

  const { error } = await service
    .from("organizations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Organizations API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ message: "Organization deleted" });
}
