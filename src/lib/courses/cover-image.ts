/**
 * Helpers for course cover images.
 *
 * A course's cover lives in `courses.thumbnail_url` (a stored, hosted image in
 * our own Supabase `course-images` bucket). When that field is empty we fall
 * back to a generated gradient placeholder, so courses without a cover still
 * look intentional.
 */

/** True when a course has a usable, stored cover image to render. */
export function hasCoverImage(thumbnailUrl?: string | null): thumbnailUrl is string {
  return typeof thumbnailUrl === "string" && thumbnailUrl.trim().length > 0;
}
