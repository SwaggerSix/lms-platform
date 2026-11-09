import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { PATH_IMAGE_BUCKET, PATH_IMAGE_PREFIX, removeStoredPathImage } from "@/lib/paths/path-image-storage";
import { COVER_IMAGE_TYPES, COVER_IMAGE_MAX_BYTES, validImageBytes } from "@/lib/images/upload-rules";

const BUCKET = PATH_IMAGE_BUCKET;
const PREFIX = PATH_IMAGE_PREFIX;

async function resolvePath(id: string) {
  const service = createServiceClient();
  const { data: path } = await service
    .from("learning_paths")
    .select("id, thumbnail_url")
    .eq("id", id)
    .maybeSingle();
  if (!path) return { error: "Learning path not found", status: 404 as const };
  return { path, service };
}

/**
 * POST /api/paths/[id]/cover
 * Upload an image for a learning path (admin). Stores it in the public
 * 'course-images' bucket and sets learning_paths.thumbnail_url to its URL.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { success } = await rateLimit(`path-cover:${auth.user.id}`, 20, 60000);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  const resolved = await resolvePath(id);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { path, service } = resolved;

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
  if (!COVER_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." }, { status: 400 });
  }
  if (file.size > COVER_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Image exceeds 5MB" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  if (!validImageBytes(buffer, file.type)) {
    return NextResponse.json({ error: "File content does not match its image type" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "png";
  const objectPath = `${PREFIX}/${path.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("Path image upload error:", uploadError.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(objectPath);
  const url = pub.publicUrl;

  const { error: updateError } = await service
    .from("learning_paths")
    .update({ thumbnail_url: url, updated_at: new Date().toISOString() })
    .eq("id", path.id);
  if (updateError) {
    await service.storage.from(BUCKET).remove([objectPath]).catch(() => {});
    console.error("Path image update error:", updateError.message);
    return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
  }

  await removeStoredPathImage(service, path.thumbnail_url).catch(() => {});

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "learning_path",
    entityId: path.id,
    newValues: { thumbnail_url: url },
  });

  return NextResponse.json({ url, path: objectPath }, { status: 201 });
}

/**
 * DELETE /api/paths/[id]/cover
 * Remove the path's image (uploaded or entered by URL). The path falls back to
 * its icon / gradient.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const resolved = await resolvePath(id);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { path, service } = resolved;

  await removeStoredPathImage(service, path.thumbnail_url).catch(() => {});

  const { error: updateError } = await service
    .from("learning_paths")
    .update({ thumbnail_url: null, updated_at: new Date().toISOString() })
    .eq("id", path.id);
  if (updateError) {
    console.error("Path image delete error:", updateError.message);
    return NextResponse.json({ error: "Failed to remove image" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "learning_path",
    entityId: path.id,
    newValues: { thumbnail_url: null },
  });

  return NextResponse.json({ ok: true });
}
