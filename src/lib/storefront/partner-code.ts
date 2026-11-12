import "server-only";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Partner codes on the storefronts, priced by the gC partner portal
// (gc-partner-portal docs/PARTNER_CODE_API.md).
//
// A subcontractor partner has ONE code that carries their badge discounts on
// every gC / GGS platform, with one buyer limit counted across all of them.
// The portal is the source of truth for what the code is worth on course
// seats (product `lms_courses`); the storefront asks it at checkout, applies
// the percentage like a percentage coupon, and reports how the order ended.
//
// Configured by two env vars; with either unset partner codes aren't
// recognised and the code box behaves exactly as before (local coupons only):
//   PARTNER_PORTAL_API_URL       e.g. https://partners.gothamculture.com
//   PARTNER_CODE_PORTAL_SECRET   the SAME value as the portal's
//                                PARTNER_CODE_SECRET_LMS
//
// Every request is signed: HMAC-SHA256(secret, `${ts}.${requestId}.${body}`)
// in X-Partner-Code-Signature, with X-Partner-Code-Platform: lms.
//
// Not every course takes the code: courses.partner_code_eligible = false
// (MOS-210 Coaching Studio and MOS-220 SurveyCraft, operator decision
// 2026-11-12) are full price for partners, alone or in a bundle. Checkout
// discounts only the other lines and asks the portal to price only them
// (partnerIneligibleLines below).

// A refusal carries the portal's own message, shown to the buyer as is
// whatever the reason ("invalid", "no_discount", "buyer_limit", or
// "partner_only": a partner code is for its partner's own purchases, so the
// portal refuses a buyer email that is not the partner's portal email).
export type PartnerEvaluation =
  | { valid: true; code: string; percentOff: number }
  | { valid: false; message: string };

/** The portal couldn't be reached or answered unexpectedly — never a discount. */
export class PartnerPortalUnavailableError extends Error {
  constructor(detail: string) {
    super(`Partner portal unavailable: ${detail}`);
    this.name = "PartnerPortalUnavailableError";
  }
}

export const PARTNER_CODE_UNAVAILABLE_MESSAGE =
  "We couldn't check that code right now. Try again in a minute, or remove it to continue.";

const TIMEOUT_MS = 8_000;

function config(): { base: string; secret: string } | null {
  const base = process.env.PARTNER_PORTAL_API_URL?.trim();
  const secret = process.env.PARTNER_CODE_PORTAL_SECRET?.trim();
  return base && secret ? { base, secret } : null;
}

export function isPartnerPortalConfigured(): boolean {
  return config() !== null;
}

/** Partner codes look like GCP-XXXXXXXXXX; the portal mints nothing else. */
export function looksLikePartnerCode(raw: string): boolean {
  return /^GCP-[A-Z0-9]{4,}$/.test(raw.trim().toUpperCase());
}

export function signPartnerRequest(secret: string, ts: string, requestId: string, body: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(`${ts}.${requestId}.${body}`).digest("hex")}`;
}

async function post(path: string, payload: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const cfg = config();
  if (!cfg) throw new PartnerPortalUnavailableError("not configured");
  // Stringified once: the signature must cover the exact bytes sent.
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = crypto.randomUUID();
  let res: Response;
  try {
    res = await fetch(new URL(path, cfg.base), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Partner-Code-Platform": "lms",
        "X-Partner-Code-Timestamp": ts,
        "X-Partner-Code-Request-Id": requestId,
        "X-Partner-Code-Signature": signPartnerRequest(cfg.secret, ts, requestId, body),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new PartnerPortalUnavailableError(err instanceof Error ? err.message : String(err));
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

/**
 * The authoritative check, made immediately before payment. Records a pending
 * use on the portal under `orderRef` (idempotent per ref), which counts toward
 * the partner's buyer limit until it is reported paid / void, or for 48 hours.
 */
export async function evaluatePartnerCode(params: {
  code: string;
  buyerEmail: string;
  buyerOrg?: string | null;
  listPriceCents: number;
  orderRef: string;
}): Promise<PartnerEvaluation> {
  const { status, json } = await post("/api/integrations/partner-codes/evaluate", {
    mode: "evaluate",
    product: "lms_courses",
    code: params.code,
    buyerEmail: params.buyerEmail,
    ...(params.buyerOrg ? { buyerOrg: params.buyerOrg } : {}),
    listPriceCents: params.listPriceCents,
    orderRef: params.orderRef,
  });
  if (status !== 200 || !json || typeof json.valid !== "boolean") {
    throw new PartnerPortalUnavailableError(`evaluate answered ${status}`);
  }
  if (json.valid) {
    if (typeof json.percentOff !== "number" || typeof json.code !== "string") {
      throw new PartnerPortalUnavailableError("evaluate answered valid without a code and percentOff");
    }
    return { valid: true, code: json.code, percentOff: json.percentOff };
  }
  return {
    valid: false,
    message: typeof json.message === "string" ? json.message : "That discount code is not valid",
  };
}

/**
 * Tell the portal how an evaluated order ended. Best effort and never throws:
 * an unreported pending use stops counting after 48 hours anyway, and a
 * reporting hiccup must never fail a checkout or a Stripe webhook.
 */
export async function reportPartnerRedemption(params: {
  orderRef: string;
  status: "paid" | "void";
}): Promise<boolean> {
  if (!config()) return false;
  try {
    const { status, json } = await post("/api/integrations/partner-codes/redemptions", params);
    if (status === 200) return true;
    // 404: the portal never saw this ref. 409: already voided.
    if (status !== 404 && status !== 409) {
      console.error(`[partner-code] report ${params.status} answered ${status}: ${String(json?.error ?? "")}`);
    }
    return false;
  } catch (err) {
    console.error("[partner-code] report failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** The portal ref a partner-code order carries in its metadata, if any. */
export function partnerPortalRef(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const ref = (metadata as { partner_portal_ref?: unknown }).partner_portal_ref;
  return typeof ref === "string" && ref.trim() ? ref : null;
}

/**
 * A partner-code order was refunded in full or cancelled: report the use void
 * so it stops counting toward the partner's buyer limit. Orders without a
 * portal ref are ignored. Like reportPartnerRedemption it never throws, so it
 * can't fail the refund; the portal is idempotent (a repeat answers 200 or
 * 409, an unknown ref 404), so reporting from more than one path is safe.
 */
export async function voidPartnerRedemptionForOrder(metadata: unknown): Promise<boolean> {
  const orderRef = partnerPortalRef(metadata);
  if (!orderRef) return false;
  return reportPartnerRedemption({ orderRef, status: "void" });
}

/** A course on a bundle's learning path (learning_path_items). */
export interface PartnerPathItem {
  path_id: string;
  course_id?: string | null;
}

/**
 * Indexes of the cart lines a partner code may not discount: a product
 * selling a course marked partner_code_eligible = false, or a bundle whose
 * learning path includes one. null when the lookup failed — the caller
 * refuses the code rather than guess which lines it covers.
 */
export async function partnerIneligibleLines(
  service: Pick<SupabaseClient, "from">,
  lines: { product: { course_id: string | null; learning_path_id?: string | null } }[],
  pathItems: PartnerPathItem[]
): Promise<Set<number> | null> {
  const courseIds = new Set<string>();
  for (const li of lines) if (li.product.course_id) courseIds.add(li.product.course_id);
  for (const item of pathItems) if (item.course_id) courseIds.add(item.course_id);
  if (courseIds.size === 0) return new Set();

  const { data, error } = await service
    .from("courses")
    .select("id")
    .in("id", [...courseIds])
    .eq("partner_code_eligible", false);
  if (error) {
    console.error("[partner-code] course eligibility lookup failed:", error.message);
    return null;
  }
  const excluded = new Set(((data as { id: string }[] | null) || []).map((c) => c.id));
  const indexes = new Set<number>();
  if (excluded.size === 0) return indexes;
  lines.forEach((li, i) => {
    const { course_id, learning_path_id } = li.product;
    const courseExcluded = Boolean(course_id && excluded.has(course_id));
    const bundleExcluded = Boolean(
      learning_path_id &&
        pathItems.some(
          (item) => item.path_id === learning_path_id && item.course_id && excluded.has(item.course_id)
        )
    );
    if (courseExcluded || bundleExcluded) indexes.add(i);
  });
  return indexes;
}

/** Refusal shown when every line in the cart is full price for partners. */
export function partnerCodeExcludedMessage(productNames: (string | null | undefined)[]): string {
  const names = [...new Set(productNames.map((n) => n?.trim()).filter((n): n is string => Boolean(n)))];
  const list =
    names.length === 0
      ? "these courses"
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  const pronoun = names.length === 1 ? "it" : "them";
  return `Partner codes don't apply to ${list} — partners pay full price for ${pronoun}. Remove the code to continue.`;
}
