import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// QuickBooks Desktop sync — RECEIVABLES side (the LMS storefront sells courses).
//
// This module turns LMS domain records (completed orders, refunds, instructor
// payouts) into normalized "post to QuickBooks" events and writes them to
// `qb_sync_queue`. It NEVER calls QuickBooks directly — a separate QB Bridge
// (Web Connector / qbXML, in gc-partner-portal) polls the queue and posts the
// transactions, then writes back QB object ids onto the source rows.
//
// The translation functions (`build*Event`) are pure so they can be unit
// tested without a database or network. `enqueue*` thin wrappers persist the
// result and are non-fatal: a QB enqueue failure must never break checkout or
// a refund. Failures are recorded on the source row's `qb_error` column.
// ---------------------------------------------------------------------------

const round = (n: number) => Math.round(n * 100) / 100;

// ─── Class mapping (one QuickBooks Class per storefront / brand) ────────────

const STOREFRONT_CLASS: Record<string, string> = {
  gothamculture: "gothamCulture",
  gothamgovernment: "Gotham Government Services",
};

/**
 * Maps a storefront (by slug) to the QuickBooks Class used to segment revenue
 * by brand. Unknown / missing storefronts fall back to a neutral class so the
 * transaction still posts and can be reclassified in QuickBooks.
 */
export function classForStorefront(slug: string | null | undefined): string {
  if (!slug) return "Unclassified";
  return STOREFRONT_CLASS[slug] ?? "Unclassified";
}

// ─── Event shapes (the normalized contract the Bridge consumes) ─────────────

export type QbEventType = "sales_receipt" | "refund_receipt" | "vendor_bill";

export interface QbCustomerRef {
  // Dedupe key the Bridge uses to upsert a QuickBooks Customer.
  dedupeKey: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
}

export interface QbLine {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number; // quantity * unitAmount, rounded
}

export interface QbSalesReceiptEvent {
  eventType: "sales_receipt";
  idempotencyKey: string;
  localType: "order";
  localId: string;
  qbClass: string;
  customer: QbCustomerRef;
  orderNumber: string | null;
  currency: string;
  lines: QbLine[];
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
}

export interface QbRefundReceiptEvent {
  eventType: "refund_receipt";
  idempotencyKey: string;
  localType: "refund";
  localId: string;
  qbClass: string;
  customer: QbCustomerRef;
  orderNumber: string | null;
  currency: string;
  amount: number;
}

export interface QbVendorBillEvent {
  eventType: "vendor_bill";
  idempotencyKey: string;
  localType: "payout";
  localId: string;
  vendor: {
    dedupeKey: string;
    name: string;
    email: string | null;
  };
  currency: string;
  amount: number;
  memo: string;
}

export type QbEvent =
  | QbSalesReceiptEvent
  | QbRefundReceiptEvent
  | QbVendorBillEvent;

// ─── Input record shapes (subset of the DB rows we read) ────────────────────

export interface OrderRecord {
  id: string;
  order_number: string | null;
  customer_email: string | null;
  customer_name: string | null;
  company_name: string | null;
  customer_phone: string | null;
  currency: string | null;
  subtotal: number | string | null;
  discount_amount: number | string | null;
  tax_amount: number | string | null;
  total: number | string | null;
  refunded_amount?: number | string | null;
}

export interface OrderItemRecord {
  product_name: string | null;
  price: number | string;
  quantity: number;
  product?: { name?: string | null } | null;
}

export interface InstructorPayoutRecord {
  id: string;
  amount: number | string;
  order_id: string | null;
  instructor: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

function customerDedupeKey(order: OrderRecord): string {
  // Prefer company (B2B seat orders), else email, else order id.
  const company = (order.company_name ?? "").trim().toLowerCase();
  if (company) return `company:${company}`;
  const email = (order.customer_email ?? "").trim().toLowerCase();
  if (email) return `email:${email}`;
  return `order:${order.id}`;
}

function buildCustomerRef(order: OrderRecord): QbCustomerRef {
  const name =
    order.company_name?.trim() ||
    order.customer_name?.trim() ||
    order.customer_email?.trim() ||
    `Order ${order.order_number ?? order.id}`;
  return {
    dedupeKey: customerDedupeKey(order),
    name,
    companyName: order.company_name?.trim() || null,
    email: order.customer_email?.trim() || null,
    phone: order.customer_phone?.trim() || null,
  };
}

// ─── Pure translators ───────────────────────────────────────────────────────

/**
 * order completed -> Customer upsert + Sales Receipt.
 * Line items come from order_items; discount and tax are carried as
 * order-level amounts; the storefront slug becomes the QuickBooks Class.
 */
export function buildSalesReceiptEvent(
  order: OrderRecord,
  items: OrderItemRecord[],
  storefrontSlug: string | null
): QbSalesReceiptEvent {
  const lines: QbLine[] = items.map((it) => {
    const unitAmount = round(num(it.price));
    const quantity = it.quantity ?? 1;
    return {
      description: it.product_name || it.product?.name || "Course",
      quantity,
      unitAmount,
      amount: round(unitAmount * quantity),
    };
  });

  return {
    eventType: "sales_receipt",
    idempotencyKey: `order:${order.id}:sales_receipt`,
    localType: "order",
    localId: order.id,
    qbClass: classForStorefront(storefrontSlug),
    customer: buildCustomerRef(order),
    orderNumber: order.order_number ?? null,
    currency: (order.currency || "USD").toUpperCase(),
    lines,
    subtotal: round(num(order.subtotal)),
    discount: round(num(order.discount_amount)),
    tax: round(num(order.tax_amount)),
    total: round(num(order.total)),
  };
}

/**
 * refund -> Credit Memo / Refund Receipt.
 *
 * A Refund Receipt represents a SINGLE refund transaction, so its `amount` must
 * be the *incremental* amount refunded in this step — never the running total,
 * or partial refunds would re-post earlier refunds and overstate the credit.
 * The cumulative refunded total is used only to make the idempotency key unique
 * per partial refund (each refund advances the cumulative figure), so distinct
 * partials each enqueue exactly once while a retry of the same refund collides.
 */
export function buildRefundReceiptEvent(
  order: OrderRecord,
  storefrontSlug: string | null,
  refundAmount: number,
  cumulativeRefunded: number
): QbRefundReceiptEvent {
  const amount = round(refundAmount);
  const cumulative = round(cumulativeRefunded);
  return {
    eventType: "refund_receipt",
    idempotencyKey: `order:${order.id}:refund:${cumulative.toFixed(2)}`,
    localType: "refund",
    localId: order.id,
    qbClass: classForStorefront(storefrontSlug),
    customer: buildCustomerRef(order),
    orderNumber: order.order_number ?? null,
    currency: (order.currency || "USD").toUpperCase(),
    amount,
  };
}

/**
 * instructor_payouts -> Vendor + Bill (accounts payable).
 */
export function buildVendorBillEvent(
  payout: InstructorPayoutRecord,
  currency = "USD"
): QbVendorBillEvent {
  const name =
    [payout.instructor.first_name, payout.instructor.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    payout.instructor.email ||
    `Instructor ${payout.instructor.id}`;
  const dedupe = payout.instructor.email
    ? `email:${payout.instructor.email.trim().toLowerCase()}`
    : `instructor:${payout.instructor.id}`;
  return {
    eventType: "vendor_bill",
    idempotencyKey: `payout:${payout.id}:vendor_bill`,
    localType: "payout",
    localId: payout.id,
    vendor: { dedupeKey: dedupe, name, email: payout.instructor.email?.trim() || null },
    currency: currency.toUpperCase(),
    amount: round(num(payout.amount)),
    memo: payout.order_id
      ? `Instructor commission for order ${payout.order_id}`
      : "Instructor commission",
  };
}

// ─── Queue writers (non-fatal side effects) ─────────────────────────────────

/**
 * Persists a single event to qb_sync_queue. The unique idempotency_key makes
 * this safe to call repeatedly: a duplicate is treated as success, not error.
 * Returns true if the row was inserted (or already existed), false on a real
 * failure. Never throws.
 */
export async function enqueueQbEvent(
  service: SupabaseClient,
  event: QbEvent
): Promise<boolean> {
  try {
    const { error } = await service
      .from("qb_sync_queue")
      .insert({
        event_type: event.eventType,
        payload: event,
        idempotency_key: event.idempotencyKey,
        status: "pending",
      });

    if (error) {
      // 23505 = unique_violation → already enqueued, that's fine (idempotent).
      if (error.code === "23505") return true;
      console.error("enqueueQbEvent insert failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("enqueueQbEvent threw:", err);
    return false;
  }
}

async function stampOrderSync(
  service: SupabaseClient,
  orderId: string,
  fields: Record<string, unknown>
): Promise<void> {
  try {
    await service.from("orders").update(fields).eq("id", orderId);
  } catch (err) {
    console.error("Could not stamp qb sync state on order", orderId, err);
  }
}

/**
 * Enqueue the Sales Receipt for a completed order. Non-fatal: on failure the
 * order is stamped qb_sync_status='error' with the reason and the caller
 * continues. Reads the storefront slug to derive the QuickBooks Class.
 */
export async function enqueueOrderCompleted(
  service: SupabaseClient,
  orderId: string
): Promise<void> {
  try {
    const { data: order } = await service
      .from("orders")
      .select(
        "id, order_number, customer_email, customer_name, company_name, customer_phone, currency, subtotal, discount_amount, tax_amount, total, storefront_id"
      )
      .eq("id", orderId)
      .single();
    if (!order) return;

    const { data: items } = await service
      .from("order_items")
      .select("product_name, price, quantity, product:products(name)")
      .eq("order_id", orderId);

    let slug: string | null = null;
    if ((order as { storefront_id?: string | null }).storefront_id) {
      const { data: store } = await service
        .from("storefronts")
        .select("slug")
        .eq("id", (order as { storefront_id: string }).storefront_id)
        .single();
      slug = store?.slug ?? null;
    }

    const event = buildSalesReceiptEvent(
      order as OrderRecord,
      (items as OrderItemRecord[] | null) ?? [],
      slug
    );

    const ok = await enqueueQbEvent(service, event);
    await stampOrderSync(service, orderId, {
      qb_sync_status: ok ? "queued" : "error",
      qb_object_type: "SalesReceipt",
      qb_error: ok ? null : "Failed to enqueue sales receipt",
    });
  } catch (err) {
    console.error("enqueueOrderCompleted failed for order", orderId, err);
    await stampOrderSync(service, orderId, {
      qb_sync_status: "error",
      qb_error: err instanceof Error ? err.message : "Unknown enqueue error",
    });
  }
}

/**
 * Enqueue a Refund Receipt / Credit Memo for an order refund. `refundAmount` is
 * the INCREMENTAL amount refunded in this step (the value posted to QuickBooks);
 * `cumulativeRefunded` is the running refunded total, used only to keep the
 * idempotency key distinct across partial refunds. Non-fatal.
 */
export async function enqueueOrderRefunded(
  service: SupabaseClient,
  orderId: string,
  refundAmount: number,
  cumulativeRefunded: number
): Promise<void> {
  try {
    if (!refundAmount || refundAmount <= 0) return;

    const { data: order } = await service
      .from("orders")
      .select(
        "id, order_number, customer_email, customer_name, company_name, customer_phone, currency, subtotal, discount_amount, tax_amount, total, refunded_amount, storefront_id"
      )
      .eq("id", orderId)
      .single();
    if (!order) return;

    let slug: string | null = null;
    if ((order as { storefront_id?: string | null }).storefront_id) {
      const { data: store } = await service
        .from("storefronts")
        .select("slug")
        .eq("id", (order as { storefront_id: string }).storefront_id)
        .single();
      slug = store?.slug ?? null;
    }

    const event = buildRefundReceiptEvent(
      order as OrderRecord,
      slug,
      refundAmount,
      cumulativeRefunded
    );
    await enqueueQbEvent(service, event);
    // We do not flip qb_sync_status here: the original sales receipt may still
    // be 'queued'/'synced'. The refund event carries its own idempotency key.
  } catch (err) {
    console.error("enqueueOrderRefunded failed for order", orderId, err);
  }
}

/**
 * Enqueue a Vendor + Bill for one or more instructor payouts. Non-fatal;
 * stamps each payout's qb_sync_status.
 */
export async function enqueueInstructorPayout(
  service: SupabaseClient,
  payoutId: string
): Promise<void> {
  try {
    const { data: payout } = await service
      .from("instructor_payouts")
      .select(
        "id, amount, order_id, instructor:users!instructor_payouts_instructor_id_fkey(id, email, first_name, last_name)"
      )
      .eq("id", payoutId)
      .single();
    if (!payout) return;

    const event = buildVendorBillEvent(payout as unknown as InstructorPayoutRecord);
    const ok = await enqueueQbEvent(service, event);

    try {
      await service
        .from("instructor_payouts")
        .update({
          qb_sync_status: ok ? "queued" : "error",
          qb_object_type: "Bill",
          qb_error: ok ? null : "Failed to enqueue vendor bill",
        })
        .eq("id", payoutId);
    } catch (err) {
      console.error("Could not stamp qb sync state on payout", payoutId, err);
    }
  } catch (err) {
    console.error("enqueueInstructorPayout failed for payout", payoutId, err);
  }
}
