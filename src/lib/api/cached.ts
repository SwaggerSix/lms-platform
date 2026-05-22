import { NextResponse } from "next/server";

interface CachedOptions {
  status?: number;
  headers?: Record<string, string>;
  /** Seconds the browser may serve a fresh copy without revalidating. */
  maxAge?: number;
  /** Seconds past max-age the browser may serve a stale copy while revalidating in the background. */
  swr?: number;
}

/**
 * Shorthand for a session-authenticated cacheable GET response:
 *
 *   Cache-Control: private, max-age=<maxAge>, stale-while-revalidate=<swr>
 *   Vary: Cookie
 *
 * Use for admin/list reads where the data changes infrequently and a
 * few seconds of staleness is fine but two users' responses must never
 * be cross-served. `private` keeps shared caches out; `Vary: Cookie`
 * is defense-in-depth for any cache that ignores `private`.
 *
 * If the caller passes their own Cache-Control or Vary, those win
 * (escape hatch for endpoints that need finer control).
 */
export function jsonCached<T>(body: T, options: CachedOptions = {}): NextResponse {
  const { status = 200, headers = {}, maxAge = 30, swr = 60 } = options;
  const merged: Record<string, string> = {
    "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
    Vary: "Cookie",
    ...headers,
  };
  return NextResponse.json(body, { status, headers: merged });
}
