import { NextResponse } from "next/server";

interface CachedOptions {
  status?: number;
  headers?: Record<string, string>;
  /** Seconds the browser may serve a fresh copy without revalidating. */
  maxAge?: number;
  /** Seconds past max-age the browser may serve a stale copy while revalidating in the background. */
  swr?: number;
  /**
   * Extra header names to add to Vary, on top of the default "Cookie".
   * Use for endpoints that accept dual auth — e.g. an admin session
   * cookie OR an Authorization bearer token — so caches key on both.
   * Pass ["Authorization"] for the cron-health pattern.
   *
   * Duplicates and "Cookie" itself are deduped automatically.
   */
  varyExtra?: string[];
}

/**
 * Shorthand for a session-authenticated cacheable GET response:
 *
 *   Cache-Control: private, max-age=<maxAge>, stale-while-revalidate=<swr>
 *   Vary: Cookie[, <extra>]
 *
 * Use for admin/list reads where the data changes infrequently and a
 * few seconds of staleness is fine but two users' responses must never
 * be cross-served. `private` keeps shared caches out; `Vary: Cookie`
 * is defense-in-depth for any cache that ignores `private`.
 *
 * If the caller passes their own Cache-Control or Vary in headers,
 * those win entirely (escape hatch for endpoints that need finer
 * control than varyExtra provides).
 */
export function jsonCached<T>(body: T, options: CachedOptions = {}): NextResponse {
  const { status = 200, headers = {}, maxAge = 30, swr = 60, varyExtra } = options;
  const varyParts = ["Cookie", ...(varyExtra ?? [])];
  // Dedupe case-insensitively while preserving first-seen order.
  const seen = new Set<string>();
  const vary = varyParts
    .filter((h) => {
      const key = h.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
  const merged: Record<string, string> = {
    "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
    Vary: vary,
    ...headers,
  };
  return NextResponse.json(body, { status, headers: merged });
}
