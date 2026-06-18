import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// QuickBooks sync reconciliation + visibility (Phase 4).
//
// The producers (Stripe webhook, checkout, refund path) enqueue events into
// qb_sync_queue, and the QB Bridge pulls/acks them (qb-bridge.ts). This module
// is the safety net: it inspects the queue and the source rows for DRIFT —
// stale leases the Bridge may have dropped, error rows, completed orders that
// never got enqueued, and a best-effort money tie-out — and rolls it up into a
// concise health summary that both the daily cron and an admin endpoint surface.
//
// The aggregation (`buildReconciliationSummary`) is a PURE function over plain
// rows so it can be unit-tested without a database. `gatherReconciliation`
// reads the rows and delegates to it.
// ---------------------------------------------------------------------------

// How long an `in_progress`/`processing` lease may sit before we consider it
// dropped by the Bridge. Mirrors the Bridge's own STALE_LEASE (15 minutes).
export const STALE_LEASE_MS = 15 * 60 * 1000;

// A completed order with no terminal QB state after this long is "stuck":
// either it was never enqueued or it has been pending/queued far too long.
export const STUCK_ORDER_MS = 6 * 60 * 60 * 1000; // 6 hours

// Cap on how many flagged ids we surface per category, so a large backlog
// doesn't produce an unbounded payload / log line.
export const MAX_FLAGGED_IDS = 50;

// ─── Row shapes (the subset of columns we read) ─────────────────────────────

export interface QueueRow {
  id: string;
  status: string;
  claimed_at: string | null;
  created_at: string;
  last_error: string | null;
}

export interface SourceRow {
  id: string;
  qb_sync_status: string | null;
  qb_synced_at: string | null;
  created_at: string;
  status?: string | null; // orders only: 'pending'|'completed'|'refunded'|'failed'
}

export interface RevenueWindowRow {
  // Completed orders within the money-check window.
  total: number | string | null;
}

export interface SyncedSalesRow {
  // Synced sales-receipt queue payloads within the window.
  total: number | string | null;
}

// ─── Summary shape (what the cron logs and the admin endpoint returns) ──────

export type QueueStatusCounts = Record<string, number>;

export interface SourceDrift {
  errorIds: string[];
  errorCount: number;
  stuckIds: string[]; // completed but no terminal QB state past STUCK_ORDER_MS
  stuckCount: number;
}

export interface MoneyCheck {
  windowHours: number;
  completedRevenue: number;
  syncedReceiptTotal: number;
  difference: number; // completedRevenue - syncedReceiptTotal (rounded)
  mismatch: boolean;
}

export interface ReconciliationSummary {
  generatedAt: string;
  queue: {
    counts: QueueStatusCounts;
    total: number;
    pending: number;
    inProgress: number;
    synced: number;
    error: number;
    staleInProgressIds: string[];
    staleInProgressCount: number;
    errorIds: string[];
  };
  orders: SourceDrift;
  payouts: SourceDrift;
  money: MoneyCheck | null;
  flagged: boolean; // true when anything needs human attention
  alerts: string[];
}

export interface ReconciliationInput {
  now: Date;
  queueRows: QueueRow[];
  orderRows: SourceRow[];
  payoutRows: SourceRow[];
  money?: {
    windowHours: number;
    revenueRows: RevenueWindowRow[];
    syncedSalesRows: SyncedSalesRow[];
    // Treat a |difference| above this (absolute, currency units) as a mismatch.
    toleranceAbs?: number;
  };
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Status vocabularies overlap between the legacy and Bridge contracts; treat
// the synonyms as one bucket. (See migration 20260618120000.)
const IN_PROGRESS_STATES = new Set(["in_progress", "processing"]);
const SYNCED_STATES = new Set(["synced", "done"]);

/**
 * Pure aggregation: plain rows in, health summary out. No I/O. This is the
 * unit-tested core; `gatherReconciliation` only feeds it.
 */
export function buildReconciliationSummary(
  input: ReconciliationInput
): ReconciliationSummary {
  const { now, queueRows, orderRows, payoutRows, money } = input;
  const nowMs = now.getTime();

  // ── Queue counts by status (+ stale in_progress leases) ──
  const counts: QueueStatusCounts = {};
  const staleInProgressIds: string[] = [];
  const errorIds: string[] = [];
  let pending = 0;
  let inProgress = 0;
  let synced = 0;
  let error = 0;

  for (const row of queueRows) {
    const status = row.status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;

    if (status === "pending") pending += 1;
    else if (IN_PROGRESS_STATES.has(status)) {
      inProgress += 1;
      const claimedMs = row.claimed_at ? Date.parse(row.claimed_at) : NaN;
      if (Number.isFinite(claimedMs) && nowMs - claimedMs > STALE_LEASE_MS) {
        if (staleInProgressIds.length < MAX_FLAGGED_IDS) staleInProgressIds.push(row.id);
      }
    } else if (SYNCED_STATES.has(status)) synced += 1;
    else if (status === "error") {
      error += 1;
      if (errorIds.length < MAX_FLAGGED_IDS) errorIds.push(row.id);
    }
  }

  // Re-count stale (we capped the id list above but want an accurate count).
  const staleInProgressCount = queueRows.filter((r) => {
    if (!IN_PROGRESS_STATES.has(r.status)) return false;
    const c = r.claimed_at ? Date.parse(r.claimed_at) : NaN;
    return Number.isFinite(c) && nowMs - c > STALE_LEASE_MS;
  }).length;

  const orders = buildSourceDrift(orderRows, nowMs, true);
  const payouts = buildSourceDrift(payoutRows, nowMs, false);

  // ── Best-effort money check ──
  let moneyCheck: MoneyCheck | null = null;
  if (money) {
    const completedRevenue = round2(
      money.revenueRows.reduce((sum, r) => sum + num(r.total), 0)
    );
    const syncedReceiptTotal = round2(
      money.syncedSalesRows.reduce((sum, r) => sum + num(r.total), 0)
    );
    const difference = round2(completedRevenue - syncedReceiptTotal);
    const tolerance = money.toleranceAbs ?? 0.01;
    moneyCheck = {
      windowHours: money.windowHours,
      completedRevenue,
      syncedReceiptTotal,
      difference,
      mismatch: Math.abs(difference) > tolerance,
    };
  }

  // ── Roll up alerts / flagged ──
  const alerts: string[] = [];
  if (staleInProgressCount > 0)
    alerts.push(
      `${staleInProgressCount} queue row(s) stuck in_progress > 15min (Bridge may have dropped the lease)`
    );
  if (error > 0) alerts.push(`${error} queue row(s) in error state`);
  if (orders.errorCount > 0) alerts.push(`${orders.errorCount} order(s) with qb_sync_status=error`);
  if (orders.stuckCount > 0)
    alerts.push(`${orders.stuckCount} completed order(s) not synced after 6h`);
  if (payouts.errorCount > 0)
    alerts.push(`${payouts.errorCount} instructor payout(s) with qb_sync_status=error`);
  if (payouts.stuckCount > 0)
    alerts.push(`${payouts.stuckCount} instructor payout(s) not synced after 6h`);
  if (moneyCheck?.mismatch)
    alerts.push(
      `Revenue tie-out mismatch over ${moneyCheck.windowHours}h: completed ${moneyCheck.completedRevenue} vs synced ${moneyCheck.syncedReceiptTotal} (Δ ${moneyCheck.difference})`
    );

  const flagged = alerts.length > 0;

  return {
    generatedAt: now.toISOString(),
    queue: {
      counts,
      total: queueRows.length,
      pending,
      inProgress,
      synced,
      error,
      staleInProgressIds,
      staleInProgressCount,
      errorIds,
    },
    orders,
    payouts,
    money: moneyCheck,
    flagged,
    alerts,
  };
}

/**
 * Flags source rows in `error`, plus rows that are "stuck": for orders, a
 * `completed` order that never reached a terminal QB state (synced) after
 * STUCK_ORDER_MS; for payouts, any payout not synced after the same window.
 */
function buildSourceDrift(
  rows: SourceRow[],
  nowMs: number,
  isOrder: boolean
): SourceDrift {
  const errorIds: string[] = [];
  const stuckIds: string[] = [];
  let errorCount = 0;
  let stuckCount = 0;

  for (const row of rows) {
    const qbStatus = row.qb_sync_status ?? "pending";
    if (qbStatus === "error") {
      errorCount += 1;
      if (errorIds.length < MAX_FLAGGED_IDS) errorIds.push(row.id);
      continue;
    }

    // Only orders that are actually `completed` should be expected to sync.
    if (isOrder && row.status !== "completed") continue;
    // Skip rows that are explicitly not meant to sync, or already synced.
    if (qbStatus === "skipped" || qbStatus === "synced") continue;

    const createdMs = row.created_at ? Date.parse(row.created_at) : NaN;
    const aged = Number.isFinite(createdMs) && nowMs - createdMs > STUCK_ORDER_MS;
    if (aged) {
      stuckCount += 1;
      if (stuckIds.length < MAX_FLAGGED_IDS) stuckIds.push(row.id);
    }
  }

  return { errorIds, errorCount, stuckIds, stuckCount };
}

// ─── I/O layer: read rows and aggregate ─────────────────────────────────────

const MONEY_WINDOW_HOURS = 24;

/**
 * Reads the queue + source rows and produces a reconciliation summary. Reads
 * are bounded; the money check is best-effort (a query failure degrades to
 * `money: null` rather than failing the whole run).
 */
export async function gatherReconciliation(
  service: SupabaseClient,
  now: Date = new Date()
): Promise<ReconciliationSummary> {
  const { data: queueData } = await service
    .from("qb_sync_queue")
    .select("id, status, claimed_at, created_at, last_error")
    .order("created_at", { ascending: true })
    .limit(5000);

  const { data: orderData } = await service
    .from("orders")
    .select("id, qb_sync_status, qb_synced_at, created_at, status")
    .neq("qb_sync_status", "synced")
    .limit(5000);

  const { data: payoutData } = await service
    .from("instructor_payouts")
    .select("id, qb_sync_status, qb_synced_at, created_at")
    .neq("qb_sync_status", "synced")
    .limit(5000);

  // Best-effort money check over the trailing window.
  const windowStart = new Date(now.getTime() - MONEY_WINDOW_HOURS * 60 * 60 * 1000);
  let money: ReconciliationInput["money"];
  try {
    const { data: revenueRows } = await service
      .from("orders")
      .select("total")
      .eq("status", "completed")
      .gte("created_at", windowStart.toISOString())
      .limit(5000);

    const { data: syncedRows } = await service
      .from("qb_sync_queue")
      .select("payload, created_at, status")
      .eq("event_type", "sales_receipt")
      .in("status", ["synced", "done"])
      .gte("created_at", windowStart.toISOString())
      .limit(5000);

    const syncedSalesRows: SyncedSalesRow[] = (syncedRows ?? []).map((r) => {
      const payload = (r as { payload?: { total?: number | string | null } }).payload ?? {};
      return { total: payload.total ?? null };
    });

    money = {
      windowHours: MONEY_WINDOW_HOURS,
      revenueRows: (revenueRows as RevenueWindowRow[] | null) ?? [],
      syncedSalesRows,
    };
  } catch (err) {
    console.error("[qb-reconcile] money check failed (non-fatal):", err);
    money = undefined;
  }

  return buildReconciliationSummary({
    now,
    queueRows: (queueData as QueueRow[] | null) ?? [],
    orderRows: (orderData as SourceRow[] | null) ?? [],
    payoutRows: (payoutData as SourceRow[] | null) ?? [],
    money,
  });
}
