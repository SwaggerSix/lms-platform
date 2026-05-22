import { NextResponse } from "next/server";

/**
 * Shorthand for NextResponse.json(body, { ...init, headers: { ...,
 * "Cache-Control": "private, no-store" } }). Side-effectful POST
 * endpoints emit no-store on every branch; this helper folds the
 * header injection into a one-call site so routes don't accumulate
 * NO_STORE constants or repeated header spreads.
 *
 *   return jsonNoStore({ ok: true }, { status: 200 });
 *   return jsonNoStore({ error: "..." }, { status: 400 });
 *
 * If the caller passes its own Cache-Control header in init, it's
 * preserved (escape hatch for the rare path that intentionally caches
 * within a no-store-default route).
 */
export function jsonNoStore<T>(
  body: T,
  init?: { status?: number; headers?: Record<string, string> }
): NextResponse {
  const status = init?.status ?? 200;
  const headers = init?.headers ?? {};
  const merged: Record<string, string> = {
    "Cache-Control": "private, no-store",
    ...headers,
  };
  return NextResponse.json(body, { status, headers: merged });
}
