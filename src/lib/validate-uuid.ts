/**
 * Canonical RFC 4122 UUID regex (lowercase or uppercase hex). Accepts
 * version 1-7; if you need to constrain to a specific version, do it
 * at the call site.
 *
 * Used at API-route boundaries so a malformed value returns a clear
 * 400 instead of bubbling into PostgREST or SQL where the error
 * message would be cryptic (or worse, would let a non-UUID-shaped
 * string flow into a `.or(field.eq.X)` filter).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Parse + validate a UUID from an unknown source (query param,
 * request body field, etc.). Returns the lowercased UUID on success
 * or null when the input is missing or malformed. Callers typically
 * map a `null` to a 400 with a clear message.
 */
export function parseUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!UUID_RE.test(value)) return null;
  return value.toLowerCase();
}
