/**
 * Helpers for serving private-bucket files via short-lived signed URLs.
 *
 * Stored file URLs are produced by Supabase `getPublicUrl`, which yields paths
 * like `https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>`.
 * For private buckets those URLs don't resolve directly, so downloads are
 * served through gated endpoints that mint a signed URL on demand.
 */

export interface ParsedStorageUrl {
  bucket: string;
  path: string;
}

/**
 * Extract the bucket and object path from a Supabase Storage URL.
 * Returns null for URLs that aren't Supabase Storage objects (e.g. external links).
 */
export function parseStorageUrl(url: string | null | undefined): ParsedStorageUrl | null {
  if (!url) return null;
  const marker = "/storage/v1/object/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  let rest = url.slice(idx + marker.length);
  rest = rest.replace(/^(public|sign|authenticated)\//, "");
  rest = rest.split("?")[0];

  const slash = rest.indexOf("/");
  if (slash === -1) return null;

  const bucket = decodeURIComponent(rest.slice(0, slash));
  const path = decodeURIComponent(rest.slice(slash + 1));
  if (!bucket || !path) return null;
  return { bucket, path };
}

/** Default lifetime for download links (seconds). */
export const DOWNLOAD_URL_TTL_SECONDS = 300;
