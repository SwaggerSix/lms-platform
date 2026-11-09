/**
 * Learning-path images (`learning_paths.thumbnail_url`).
 *
 * An image is either uploaded (stored in the public `course-images` bucket
 * under `paths/<pathId>/…`, see POST /api/paths/[id]/cover) or entered by
 * hand. A hand-entered value must be an https URL or a same-origin path
 * starting with a single "/" (e.g. "/images/paths/mosaic-certification.jpg",
 * a static file in public/). Anything else — javascript:, data:, http:,
 * protocol-relative "//host" — is refused.
 */

export const PATH_IMAGE_URL_MAX = 2048;

export function isValidPathImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > PATH_IMAGE_URL_MAX) return false;
  if (/\s/.test(v)) return false;
  if (v.startsWith("/")) {
    // Same-origin path. "//host" and "/\host" are protocol-relative in browsers.
    return !v.startsWith("//") && !v.startsWith("/\\");
  }
  try {
    const url = new URL(v);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Normalise a thumbnail_url coming from a request body.
 * - undefined → leave unchanged
 * - null / "" → clear the image
 * - a valid URL → trimmed URL
 * - anything else → invalid
 */
export function parsePathImageInput(
  value: unknown
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "Image URL must be a string" };
  const v = value.trim();
  if (!v) return { ok: true, value: null };
  if (!isValidPathImageUrl(v)) {
    return {
      ok: false,
      error: "Image URL must start with https:// or be a site path starting with /",
    };
  }
  return { ok: true, value: v };
}

/** True when a path has an image to render. */
export function hasPathImage(url?: string | null): url is string {
  return typeof url === "string" && url.trim().length > 0;
}
