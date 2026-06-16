import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { buildProvenanceColumns, emptyProvenanceColumns } from "@/lib/courses/cover-provenance";

const BUCKET = "course-images";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/** Validate image magic bytes against the claimed MIME type. */
function validImageBytes(buffer: ArrayBuffer, claimedType: string): boolean {
  const b = new Uint8Array(buffer.slice(0, 12));
  switch (claimedType) {
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case "image/gif":
      return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
    case "image/webp":
      // "RIFF" .... "WEBP"
      return (
        b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
      );
    default:
      return false;
  }
}

/** Resolve the course and verify the caller is allowed to edit its cover. */
async function resolveCourse(slug: string, user: { id: string; role: string }) {
  const service = createServiceClient();
  const { data: course } = await service
    .from("courses")
    .select("id, created_by, thumbnail_url")
    .eq("slug", slug)
    .single();
  if (!course) return { error: "Course not found", status: 404 as const };
  // Instructors may only edit covers for courses they own; admins/super_admins may edit any.
  if (user.role === "instructor" && course.created_by !== user.id) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { course, service };
}

/** Remove a previously stored cover object (best-effort) when it lived in our bucket. */
async function removeStoredCover(
  service: ReturnType<typeof createServiceClient>,
  thumbnailUrl: string | null
) {
  if (!thumbnailUrl) return;
  const marker = `/object/public/${BUCKET}/`;
  const idx = thumbnailUrl.indexOf(marker);
  if (idx === -1) return; // Not one of ours (e.g. an external/marketplace URL) — leave it alone.
  const path = decodeURIComponent(thumbnailUrl.slice(idx + marker.length));
  if (path) await service.storage.from(BUCKET).remove([path]);
}

/**
 * POST /api/courses/[slug]/cover
 * Upload a licensed cover image for a course. Stores the file in the public
 * 'course-images' bucket and sets courses.thumbnail_url to its public URL.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { success } = await rateLimit(`course-cover:${auth.user.id}`, 20, 60000);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { slug } = await params;
  const resolved = await resolveCourse(slug, auth.user);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { course, service } = resolved;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image exceeds 5MB" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  if (!validImageBytes(buffer, file.type)) {
    return NextResponse.json({ error: "File content does not match its image type" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "png";
  const path = `${course.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("Course cover upload error:", uploadError.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  // Optional provenance (licensing audit trail). Free-text; normalized server-side.
  const provenance = buildProvenanceColumns({
    sourceUrl: form.get("source_url")?.toString() ?? null,
    sourceName: form.get("source_name")?.toString() ?? null,
    license: form.get("license")?.toString() ?? null,
    attribution: form.get("attribution")?.toString() ?? null,
    origin: form.get("origin")?.toString() ?? null,
  });

  const { error: updateError } = await service
    .from("courses")
    .update({ thumbnail_url: url, ...provenance, updated_at: new Date().toISOString() })
    .eq("id", course.id);
  if (updateError) {
    // Roll back the just-uploaded object so we don't leave an orphan.
    await service.storage.from(BUCKET).remove([path]).catch(() => {});
    console.error("Course cover update error:", updateError.message);
    return NextResponse.json({ error: "Failed to save cover" }, { status: 500 });
  }

  // Replace any prior cover we owned (best-effort; ignore failures).
  await removeStoredCover(service, course.thumbnail_url).catch(() => {});

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "course",
    entityId: course.id,
    newValues: { thumbnail_url: url },
  });

  return NextResponse.json({ url, path }, { status: 201 });
}

/**
 * DELETE /api/courses/[slug]/cover
 * Remove the uploaded cover; the course falls back to its generated cover art.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { slug } = await params;
  const resolved = await resolveCourse(slug, auth.user);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { course, service } = resolved;

  await removeStoredCover(service, course.thumbnail_url).catch(() => {});

  const { error: updateError } = await service
    .from("courses")
    .update({ thumbnail_url: null, ...emptyProvenanceColumns(), updated_at: new Date().toISOString() })
    .eq("id", course.id);
  if (updateError) {
    console.error("Course cover delete error:", updateError.message);
    return NextResponse.json({ error: "Failed to remove cover" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "course",
    entityId: course.id,
    newValues: { thumbnail_url: null },
  });

  return NextResponse.json({ ok: true });
}
