import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/documents/[id]/acknowledge
 * Records that the current user has acknowledged the document.
 * Idempotent: acknowledging twice keeps the original timestamp.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: caller } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!caller) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: document } = await service
    .from("documents")
    .select("id, acknowledgment_required")
    .eq("id", documentId)
    .single();
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { error } = await service
    .from("document_acknowledgments")
    .upsert(
      { document_id: documentId, user_id: caller.id },
      { onConflict: "document_id,user_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("Failed to record document acknowledgment:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ acknowledged: true });
}
