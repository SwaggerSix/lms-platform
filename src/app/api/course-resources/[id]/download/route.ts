import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseStorageUrl, DOWNLOAD_URL_TTL_SECONDS } from "@/lib/storage-download";

/**
 * GET /api/course-resources/[id]/download
 * Enrollment-gated download. Only staff or learners enrolled in the resource's
 * course may download; facilitator-audience resources are staff-only. Returns a
 * 302 redirect to a short-lived signed URL (files live in a private bucket).
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

  const { data: resource } = await service
    .from("course_resources")
    .select("course_id, audience, file_url, file_name")
    .eq("id", id)
    .single();
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isStaff = ["admin", "super_admin", "instructor"].includes(profile.role);

  // Facilitator materials are staff-only.
  if (resource.audience === "facilitator" && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Learners must be enrolled in the course.
  if (!isStaff) {
    const { data: enrollment } = await service
      .from("enrollments")
      .select("id")
      .eq("user_id", profile.id)
      .eq("course_id", resource.course_id)
      .maybeSingle();
    if (!enrollment) {
      return NextResponse.json({ error: "You must be enrolled to access this material" }, { status: 403 });
    }
  }

  const parsed = parseStorageUrl(resource.file_url);
  // External (non-storage) links: redirect through after the access check.
  if (!parsed) {
    if (resource.file_url) return NextResponse.redirect(resource.file_url);
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  const { data: signed, error } = await service.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, DOWNLOAD_URL_TTL_SECONDS, { download: resource.file_name ?? true });

  if (error || !signed) {
    console.error("Course resource signed URL error:", error?.message);
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
