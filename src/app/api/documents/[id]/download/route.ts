import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseStorageUrl, DOWNLOAD_URL_TTL_SECONDS } from "@/lib/storage-download";

/**
 * GET /api/documents/[id]/download
 * Serves a document via a short-lived signed URL. A learner may download their
 * own personal documents (user_id = them) and org-wide documents (user_id null);
 * staff may download any. Files live in a private bucket.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: doc } = await service
    .from("documents")
    .select("user_id, file_url, file_name")
    .eq("id", id)
    .single();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isStaff = ["admin", "super_admin"].includes(profile.role);
  const allowed = isStaff || doc.user_id === null || doc.user_id === profile.id;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = parseStorageUrl(doc.file_url);
  if (!parsed) {
    if (doc.file_url && doc.file_url !== "#") return NextResponse.redirect(doc.file_url);
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  const { data: signed, error } = await service.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, DOWNLOAD_URL_TTL_SECONDS, { download: doc.file_name ?? true });

  if (error || !signed) {
    console.error("Document signed URL error:", error?.message);
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
