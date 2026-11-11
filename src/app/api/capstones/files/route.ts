import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { CAPSTONE_BUCKET } from "@/lib/capstones/rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/capstones/files?submission=<id>&path=<storage path>
 *
 * Redirects to a 5-minute signed download link for one file of a capstone
 * submission. Allowed for the learner who submitted it and for admins; the
 * path must be one the submission lists, so nothing else in the bucket can be
 * reached through here.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const submissionId = request.nextUrl.searchParams.get("submission") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!UUID.test(submissionId) || !path) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = createServiceClient();
  const { data: row } = await service
    .from("capstone_submissions")
    .select("user_id, files")
    .eq("id", submissionId)
    .maybeSingle();
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  if (!row || (row.user_id !== auth.user.id && !isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const file = ((row.files ?? []) as { path: string; name: string }[]).find((f) => f.path === path);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await service.storage
    .from(CAPSTONE_BUCKET)
    .createSignedUrl(file.path, 300, { download: file.name });
  if (error || !data?.signedUrl) {
    console.error("[capstones] signed download URL error:", error?.message);
    return NextResponse.json({ error: "Could not open the file." }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl, 302);
}
