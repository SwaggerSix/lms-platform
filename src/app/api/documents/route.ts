import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import type { DocumentVisibility } from "@/types/database";

/**
 * GET /api/documents
 * Query params: folder_id, search, visibility
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folder_id");
  const search = searchParams.get("search");
  const visibility = searchParams.get("visibility") as DocumentVisibility | null;
  const service = createServiceClient();

  let query = service.from("documents").select("*").order("updated_at", { ascending: false });

  if (folderId) {
    query = query.eq("folder_id", folderId);
  }
  if (visibility) {
    query = query.eq("visibility", visibility);
  }
  if (search) {
    const sanitizedSearch = search.replace(/[%_\\'"()]/g, "");
    query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Documents API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: data?.length ?? 0,
  });
}

/**
 * POST /api/documents
 * Body: Partial<Document> with required title
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }
    const service = createServiceClient();

    // Derive uploaded_by from authenticated user's profile, not request body
    const { data: profile } = await service
      .from("users")
      .select("id, organization_id")
      .eq("auth_id", user!.id)
      .single();

    const { data, error } = await service
      .from("documents")
      .insert({
        folder_id: body.folder_id ?? null,
        title: body.title,
        description: body.description ?? null,
        file_url: body.file_url ?? "#",
        file_name: body.file_name ?? `${body.title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        file_type: body.file_type ?? "pdf",
        file_size: body.file_size ?? 0,
        mime_type: body.mime_type ?? null,
        version: 1,
        tags: body.tags ?? [],
        organization_id: profile?.organization_id ?? null,
        visibility: body.visibility ?? "all",
        is_policy: body.is_policy ?? false,
        effective_date: body.effective_date ?? null,
        expiry_date: body.expiry_date ?? null,
        acknowledgment_required: body.acknowledgment_required ?? false,
        uploaded_by: profile?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Documents API error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/documents
 * Body: { id: string, ...fieldsToUpdate }
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Document id is required" },
        { status: 400 }
      );
    }

    const { id } = body;
    const allowedFields = ["title", "description", "category", "folder_id", "status", "tags"] as const;
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    const service = createServiceClient();

    const { data, error } = await service
      .from("documents")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      console.error("Documents API error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/documents
 * Query param: id
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Document id is required" },
      { status: 400 }
    );
  }
  const service = createServiceClient();

  const { data, error } = await service
    .from("documents")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    console.error("Documents API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ data, message: "Document deleted" });
}
