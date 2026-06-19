import "server-only";

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { QbEvent } from "@/lib/integrations/qbo-sync";

// ---------------------------------------------------------------------------
// QB Bridge pull/ack — the LMS side of the PER-APP PULL design.
//
// The QB Bridge (Web Connector / qbXML, in gc-partner-portal) authenticates
// with a static bearer token (env QB_BRIDGE_TOKEN) and:
//   1. PULLs queued events (leased atomically via claim_qb_bridge_events).
//   2. ACKs results, on which we write QB ids back onto the source rows and
//      upsert qb_entity_map.
//
// These are machine-to-machine endpoints. They do NOT use withAuth / user
// sessions. The bearer token IS the security boundary; the routes run as the
// service-role client (RLS bypassed), which is correct for an authenticated
// machine endpoint. The write-back logic lives here (not in the route) so it
// can be unit-tested with a mocked Supabase client.
// ---------------------------------------------------------------------------

const STALE_LEASE = "15 minutes";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ─── Auth ───────────────────────────────────────────────────────────────────

/**
 * Timing-safe comparison of the presented bearer token against QB_BRIDGE_TOKEN.
 * Returns false (never throws) when the env var is unset or the token is
 * missing/wrong. Always compares the full digest so the comparison time does
 * not leak the token length.
 */
export function verifyBridgeToken(provided: string | null | undefined): boolean {
  const expected = process.env.QB_BRIDGE_TOKEN;
  if (!expected || !provided) return false;
  try {
    // Hash both sides to a fixed-length digest so timingSafeEqual gets equal
    // length buffers regardless of input length (and length isn't leaked).
    const a = crypto.createHash("sha256").update(provided).digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Extracts the bearer token from an Authorization header value. */
export function bearerFromHeader(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
}

// ─── Pull (lease) ─────────────────────────────────────────────────────────────

export interface LeasedEvent {
  id: string;
  idempotencyKey: string;
  eventType: string;
  payload: QbEvent;
  claimedAt: string | null;
}

/** Clamps a requested limit into [1, MAX_LIMIT], defaulting on bad input. */
export function clampLimit(raw: string | null | undefined): number {
  const n = raw == null ? DEFAULT_LIMIT : Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

interface QueueRow {
  id: string;
  idempotency_key: string;
  event_type: string;
  payload: QbEvent;
  claimed_at: string | null;
}

/**
 * Atomically leases up to `limit` claimable rows via the claim_qb_bridge_events
 * Postgres function (FOR UPDATE SKIP LOCKED) and returns them in the wire shape.
 */
export async function leasePendingEvents(
  service: SupabaseClient,
  limit: number
): Promise<LeasedEvent[]> {
  const { data, error } = await service.rpc("claim_qb_bridge_events", {
    p_limit: limit,
    p_stale_after: STALE_LEASE,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as QueueRow[];
  return rows.map((r) => ({
    id: r.id,
    idempotencyKey: r.idempotency_key,
    eventType: r.event_type,
    payload: r.payload,
    claimedAt: r.claimed_at,
  }));
}

// ─── Ack (write-back) ─────────────────────────────────────────────────────────

export const ackResultSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["synced", "error"]),
  qbType: z.string().optional(),
  qbListId: z.string().optional(),
  qbTxnId: z.string().optional(),
  error: z.string().optional(),
});

export const ackBodySchema = z.object({
  results: z.array(ackResultSchema),
});

export type AckResult = z.infer<typeof ackResultSchema>;

/** Maps a QbEvent's localType to the qb_entity_map.local_type vocabulary. */
function entityMapType(localType: string | undefined): string | null {
  // order → sales_receipt, refund → refund_receipt, payout → vendor_bill.
  if (localType === "order") return "order";
  if (localType === "refund") return "refund";
  if (localType === "payout") return "payout";
  return null;
}

/**
 * Applies a single ack result against the queue row and (on success) the
 * source row + entity map. Returns true when the queue row update succeeded.
 *
 * Defensive: a missing source row or a failed write-back is logged and must
 * NOT throw — the queue row status is still the source of truth for the
 * Bridge, and one bad row must not poison the whole batch.
 */
export async function applyAckResult(
  service: SupabaseClient,
  result: AckResult
): Promise<boolean> {
  // Look up the queue row so we can read its payload (local id / event type).
  const { data: row, error: fetchErr } = await service
    .from("qb_sync_queue")
    .select("id, event_type, payload, idempotency_key")
    .eq("id", result.id)
    .maybeSingle();

  if (fetchErr || !row) {
    console.error("[qb-bridge ack] queue row not found", result.id, fetchErr?.message);
    return false;
  }

  if (result.status === "error") {
    const { error } = await service
      .from("qb_sync_queue")
      .update({ status: "error", last_error: result.error ?? "Bridge reported error" })
      .eq("id", result.id);
    if (error) {
      console.error("[qb-bridge ack] failed to mark error", result.id, error.message);
      return false;
    }
    return true;
  }

  // status === "synced": mark the queue row done first (source of truth).
  const syncedAt = new Date().toISOString();
  const { error: queueErr } = await service
    .from("qb_sync_queue")
    .update({ status: "synced", processed_at: syncedAt, last_error: null })
    .eq("id", result.id);
  if (queueErr) {
    console.error("[qb-bridge ack] failed to mark synced", result.id, queueErr.message);
    return false;
  }

  const payload = (row.payload ?? {}) as QbEvent;
  const localType = entityMapType(payload.localType);
  const localId = payload.localId;
  const idempotencyKey = (row as QueueRow).idempotency_key;

  // Each partial refund is a distinct QB refund_receipt. The order's local id is
  // shared across all of them, so keying the entity-map row on local_id would
  // make a second partial refund overwrite the first refund's qb_txnid (unique
  // on local_type,local_id). The queue row's idempotency_key is
  // `order:<id>:refund:<cumulative>` — unique per partial refund — so use it as
  // the entity-map local_id for refunds. order/payout keep their natural id.
  const entityMapLocalId = localType === "refund" ? idempotencyKey : localId;

  // Best-effort: upsert qb_entity_map. Never fatal. Skip entirely when there is
  // no qbType to record — we never store an empty qb_type.
  if (localType && entityMapLocalId && result.qbType) {
    try {
      const { error } = await service.from("qb_entity_map").upsert(
        {
          local_type: localType,
          local_id: entityMapLocalId,
          qb_type: result.qbType,
          qb_listid: result.qbListId ?? null,
          qb_txnid: result.qbTxnId ?? null,
          updated_at: syncedAt,
        },
        { onConflict: "local_type,local_id" }
      );
      if (error) {
        console.error("[qb-bridge ack] entity map upsert failed", result.id, error.message);
      }
    } catch (err) {
      console.error("[qb-bridge ack] entity map upsert threw", result.id, err);
    }
  }

  // Best-effort: write QB ids back onto the source row. Never fatal.
  try {
    if (payload.eventType === "vendor_bill" && localId) {
      const { error } = await service
        .from("instructor_payouts")
        .update({
          qb_object_id: result.qbTxnId ?? null,
          qb_object_type: result.qbType ?? "Bill",
          qb_sync_status: "synced",
          qb_synced_at: syncedAt,
          qb_error: null,
        })
        .eq("id", localId);
      if (error) {
        console.error("[qb-bridge ack] payout write-back failed", localId, error.message);
      }
    } else if (
      (payload.eventType === "sales_receipt" || payload.eventType === "refund_receipt") &&
      localId
    ) {
      // The order row's qb_object_id should hold the ORIGINAL sales-receipt
      // TxnID for the lifetime of the order. A refund_receipt is a separate QB
      // transaction (tracked under its own local_type='refund' key in
      // qb_entity_map, upserted above), so on a refund ack we must NOT overwrite
      // qb_object_id / qb_object_type — that would replace the sales-receipt id
      // with the refund's TxnID. We still stamp qb_synced_at to record that the
      // order's QB activity advanced. sales_receipt keeps setting the ids.
      const orderUpdate: Record<string, unknown> = {
        qb_sync_status: "synced",
        qb_synced_at: syncedAt,
        qb_error: null,
      };
      if (payload.eventType === "sales_receipt") {
        orderUpdate.qb_object_id = result.qbTxnId ?? null;
        orderUpdate.qb_object_type = result.qbType ?? "SalesReceipt";
      }
      const { error } = await service
        .from("orders")
        .update(orderUpdate)
        .eq("id", localId);
      if (error) {
        console.error("[qb-bridge ack] order write-back failed", localId, error.message);
      }
    }
  } catch (err) {
    console.error("[qb-bridge ack] source write-back threw", result.id, err);
  }

  return true;
}

/**
 * Applies all ack results. Each result is handled independently so one bad
 * row never fails the batch. Returns the count of queue rows updated.
 */
export async function applyAckBatch(
  service: SupabaseClient,
  results: AckResult[]
): Promise<number> {
  let updated = 0;
  for (const result of results) {
    try {
      if (await applyAckResult(service, result)) updated += 1;
    } catch (err) {
      // applyAckResult is already defensive, but belt-and-suspenders.
      console.error("[qb-bridge ack] result threw", result.id, err);
    }
  }
  return updated;
}
