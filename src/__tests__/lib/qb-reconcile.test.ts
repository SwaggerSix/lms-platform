import { describe, it, expect, vi } from "vitest";

import {
  buildReconciliationSummary,
  gatherReconciliation,
  STALE_LEASE_MS,
  STUCK_ORDER_MS,
  MAX_FLAGGED_IDS,
  type ReconciliationInput,
  type QueueRow,
  type SourceRow,
} from "@/lib/integrations/qb-reconcile";

const NOW = new Date("2026-06-18T12:00:00.000Z");
const nowMs = NOW.getTime();

function iso(offsetMs: number): string {
  return new Date(nowMs + offsetMs).toISOString();
}

function baseInput(overrides: Partial<ReconciliationInput> = {}): ReconciliationInput {
  return {
    now: NOW,
    queueRows: [],
    orderRows: [],
    payoutRows: [],
    ...overrides,
  };
}

// ─── Queue status counts ─────────────────────────────────────────────────────

describe("buildReconciliationSummary — queue counts", () => {
  it("buckets statuses and treats legacy synonyms (processing→in_progress, done→synced)", () => {
    const queueRows: QueueRow[] = [
      { id: "a", status: "pending", claimed_at: null, created_at: iso(-1000), last_error: null },
      { id: "b", status: "pending", claimed_at: null, created_at: iso(-1000), last_error: null },
      { id: "c", status: "in_progress", claimed_at: iso(-1000), created_at: iso(-2000), last_error: null },
      { id: "d", status: "processing", claimed_at: iso(-1000), created_at: iso(-2000), last_error: null },
      { id: "e", status: "synced", claimed_at: null, created_at: iso(-5000), last_error: null },
      { id: "f", status: "done", claimed_at: null, created_at: iso(-5000), last_error: null },
      { id: "g", status: "error", claimed_at: null, created_at: iso(-5000), last_error: "boom" },
    ];

    const s = buildReconciliationSummary(baseInput({ queueRows }));

    expect(s.queue.total).toBe(7);
    expect(s.queue.pending).toBe(2);
    expect(s.queue.inProgress).toBe(2); // in_progress + processing
    expect(s.queue.synced).toBe(2); // synced + done
    expect(s.queue.error).toBe(1);
    expect(s.queue.counts).toEqual({
      pending: 2,
      in_progress: 1,
      processing: 1,
      synced: 1,
      done: 1,
      error: 1,
    });
    expect(s.queue.errorIds).toEqual(["g"]);
  });

  it("flags in_progress rows whose lease is older than the stale window", () => {
    const queueRows: QueueRow[] = [
      // fresh lease — not stale
      { id: "fresh", status: "in_progress", claimed_at: iso(-(STALE_LEASE_MS - 60_000)), created_at: iso(-100), last_error: null },
      // stale lease — Bridge likely dropped it
      { id: "stale", status: "in_progress", claimed_at: iso(-(STALE_LEASE_MS + 60_000)), created_at: iso(-100), last_error: null },
      // stale via legacy 'processing'
      { id: "stale2", status: "processing", claimed_at: iso(-(STALE_LEASE_MS + 120_000)), created_at: iso(-100), last_error: null },
      // in_progress but no claimed_at — cannot judge, not flagged
      { id: "noclaim", status: "in_progress", claimed_at: null, created_at: iso(-100), last_error: null },
    ];

    const s = buildReconciliationSummary(baseInput({ queueRows }));

    expect(s.queue.staleInProgressCount).toBe(2);
    expect(s.queue.staleInProgressIds.sort()).toEqual(["stale", "stale2"]);
    expect(s.flagged).toBe(true);
    expect(s.alerts.some((a) => a.includes("stuck in_progress"))).toBe(true);
  });

  it("caps flagged id lists at MAX_FLAGGED_IDS while keeping accurate counts", () => {
    const queueRows: QueueRow[] = Array.from({ length: MAX_FLAGGED_IDS + 10 }, (_, i) => ({
      id: `stale-${i}`,
      status: "in_progress",
      claimed_at: iso(-(STALE_LEASE_MS + 60_000)),
      created_at: iso(-100),
      last_error: null,
    }));

    const s = buildReconciliationSummary(baseInput({ queueRows }));
    expect(s.queue.staleInProgressCount).toBe(MAX_FLAGGED_IDS + 10);
    expect(s.queue.staleInProgressIds.length).toBe(MAX_FLAGGED_IDS);
  });
});

// ─── Source drift (orders / payouts) ─────────────────────────────────────────

describe("buildReconciliationSummary — source drift", () => {
  it("flags error orders and completed orders stuck unsynced past the window", () => {
    const orderRows: SourceRow[] = [
      { id: "err", qb_sync_status: "error", qb_synced_at: null, created_at: iso(-1000), status: "completed" },
      // completed + queued + old → stuck
      { id: "stuck", qb_sync_status: "queued", qb_synced_at: null, created_at: iso(-(STUCK_ORDER_MS + 60_000)), status: "completed" },
      // completed + queued + recent → not stuck
      { id: "recent", qb_sync_status: "queued", qb_synced_at: null, created_at: iso(-1000), status: "completed" },
      // old but not completed (pending) → ignored
      { id: "pending-order", qb_sync_status: "pending", qb_synced_at: null, created_at: iso(-(STUCK_ORDER_MS + 60_000)), status: "pending" },
      // old but skipped → ignored
      { id: "skipped", qb_sync_status: "skipped", qb_synced_at: null, created_at: iso(-(STUCK_ORDER_MS + 60_000)), status: "completed" },
    ];

    const s = buildReconciliationSummary(baseInput({ orderRows }));

    expect(s.orders.errorCount).toBe(1);
    expect(s.orders.errorIds).toEqual(["err"]);
    expect(s.orders.stuckCount).toBe(1);
    expect(s.orders.stuckIds).toEqual(["stuck"]);
    expect(s.flagged).toBe(true);
  });

  it("flags payouts regardless of an order status column (payouts have none)", () => {
    const payoutRows: SourceRow[] = [
      { id: "p-err", qb_sync_status: "error", qb_synced_at: null, created_at: iso(-1000) },
      { id: "p-stuck", qb_sync_status: "queued", qb_synced_at: null, created_at: iso(-(STUCK_ORDER_MS + 60_000)) },
      { id: "p-recent", qb_sync_status: "queued", qb_synced_at: null, created_at: iso(-1000) },
    ];

    const s = buildReconciliationSummary(baseInput({ payoutRows }));
    expect(s.payouts.errorIds).toEqual(["p-err"]);
    expect(s.payouts.stuckIds).toEqual(["p-stuck"]);
  });

  it("is clean (not flagged) when nothing is wrong", () => {
    const queueRows: QueueRow[] = [
      { id: "a", status: "synced", claimed_at: null, created_at: iso(-5000), last_error: null },
      { id: "b", status: "pending", claimed_at: null, created_at: iso(-5000), last_error: null },
    ];
    const orderRows: SourceRow[] = [
      { id: "ok", qb_sync_status: "queued", qb_synced_at: null, created_at: iso(-1000), status: "completed" },
    ];
    const s = buildReconciliationSummary(baseInput({ queueRows, orderRows }));
    expect(s.flagged).toBe(false);
    expect(s.alerts).toEqual([]);
  });
});

// ─── Money check ─────────────────────────────────────────────────────────────

describe("buildReconciliationSummary — money tie-out", () => {
  it("computes the difference and does not flag within tolerance", () => {
    const s = buildReconciliationSummary(
      baseInput({
        money: {
          windowHours: 24,
          revenueRows: [{ total: "100.00" }, { total: 50 }],
          syncedSalesRows: [{ total: 150 }],
        },
      })
    );
    expect(s.money).not.toBeNull();
    expect(s.money?.completedRevenue).toBe(150);
    expect(s.money?.syncedReceiptTotal).toBe(150);
    expect(s.money?.difference).toBe(0);
    expect(s.money?.mismatch).toBe(false);
    expect(s.flagged).toBe(false);
  });

  it("flags a mismatch beyond tolerance", () => {
    const s = buildReconciliationSummary(
      baseInput({
        money: {
          windowHours: 24,
          revenueRows: [{ total: 200 }],
          syncedSalesRows: [{ total: 150 }],
        },
      })
    );
    expect(s.money?.difference).toBe(50);
    expect(s.money?.mismatch).toBe(true);
    expect(s.flagged).toBe(true);
    expect(s.alerts.some((a) => a.includes("tie-out mismatch"))).toBe(true);
  });

  it("omits the money check when no money input is provided", () => {
    const s = buildReconciliationSummary(baseInput());
    expect(s.money).toBeNull();
  });
});

// ─── I/O layer (mocked supabase) ─────────────────────────────────────────────

describe("gatherReconciliation", () => {
  it("reads the queue/source/money rows and produces a summary", async () => {
    const queueRows = [
      { id: "q1", status: "pending", claimed_at: null, created_at: iso(-1000), last_error: null },
      { id: "q2", status: "error", claimed_at: null, created_at: iso(-1000), last_error: "x" },
    ];
    const orderRows = [
      { id: "o1", qb_sync_status: "error", qb_synced_at: null, created_at: iso(-1000), status: "completed" },
    ];
    const payoutRows: unknown[] = [];
    const revenueRows = [{ total: 100 }];
    const syncedSalesRows = [{ payload: { total: 80 }, created_at: iso(-1000), status: "synced" }];

    // Build a chainable query stub whose terminal `.limit()` resolves to data.
    function query(data: unknown) {
      const api: Record<string, unknown> = {};
      const chain = () => api;
      for (const m of ["select", "order", "neq", "eq", "in", "gte"]) {
        api[m] = vi.fn(chain);
      }
      api.limit = vi.fn().mockResolvedValue({ data, error: null });
      return api;
    }

    // Each .from() call maps in the order the function issues them. Use a
    // queue: queue rows, orders(drift), payouts, orders(revenue), queue(synced).
    const responses = [queueRows, orderRows, payoutRows, revenueRows, syncedSalesRows];
    let call = 0;
    const service = {
      from: vi.fn(() => query(responses[call++])),
    } as unknown as Parameters<typeof gatherReconciliation>[0];

    const summary = await gatherReconciliation(service, NOW);

    expect(summary.queue.total).toBe(2);
    expect(summary.queue.error).toBe(1);
    expect(summary.orders.errorIds).toEqual(["o1"]);
    expect(summary.money?.completedRevenue).toBe(100);
    expect(summary.money?.syncedReceiptTotal).toBe(80);
    expect(summary.money?.difference).toBe(20);
    expect(summary.flagged).toBe(true);
  });
});
