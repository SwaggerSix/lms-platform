import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";

/**
 * Uploaded learning-path images live in the public `course-images` bucket (the
 * one course covers use) under `paths/<pathId>/`.
 */
export const PATH_IMAGE_BUCKET = "course-images";
export const PATH_IMAGE_PREFIX = "paths";

/**
 * Best-effort removal of a previously uploaded path image. Only objects under
 * `paths/` in our bucket are touched — a static "/images/…" path, an external
 * URL, or a course cover pasted in as a path's image are left alone.
 */
export async function removeStoredPathImage(
  service: ReturnType<typeof createServiceClient>,
  thumbnailUrl: string | null | undefined
): Promise<void> {
  if (!thumbnailUrl) return;
  const marker = `/object/public/${PATH_IMAGE_BUCKET}/`;
  const idx = thumbnailUrl.indexOf(marker);
  if (idx === -1) return;
  const objectPath = decodeURIComponent(thumbnailUrl.slice(idx + marker.length).split("?")[0]);
  if (!objectPath.startsWith(`${PATH_IMAGE_PREFIX}/`)) return;
  await service.storage.from(PATH_IMAGE_BUCKET).remove([objectPath]);
}
