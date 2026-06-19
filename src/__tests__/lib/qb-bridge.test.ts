import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  verifyBridgeToken,
  bearerFromHeader,
  clampLimit,
  applyAckResult,
  applyAckBatch,
  ackBodySchema,
} from "@/lib/integrations/qb-bridge";

// ─── Auth ─────────────────────────────────────────────────────────────────

describe("verifyBridgeToken", () => {
  const ORIGINAL = process.env.QB_BRIDGE_TOKEN;
  beforeEach(() => {
    process.env.QB_BRIDGE_TOKEN = "the-expected-token";
  });
  afterEach(() => {
    process.env.QB_BRIDGE_TOKEN = ORIGINAL;
  });

  it("accepts the exact token", () => {
    expect(verifyBridgeToken("the-expected-token")).toBe(true);
  });
  it("rejects a wrong token (timing-safe, no throw on length mismatch)", () => {
    expect(verifyBridgeToken("nope")).toBe(false);
    expect(verifyBridgeToken("the-expected-token-but-longer")).toBe(false);
  });
  it("rejects missing token", () => {
    expect(verifyBridgeToken(null)).toBe(false);
    expect(verifyBridgeToken(undefined)).toBe(false);
    expect(verifyBridgeToken("")).toBe(false);
  });
  it("rejects when env var unset", () => {
    delete process.env.QB_BRIDGE_TOKEN;
    expect(verifyBridgeToken("anything")).toBe(false);
  });
});

describe("bearerFromHeader", () => {
  it("extracts the bearer token", () => {
    expect(bearerFromHeader("Bearer abc123")).toBe("abc123");
  });
  it("returns null for non-bearer / missing", () => {
    expect(bearerFromHeader(null)).toBeNull();
    expect(bearerFromHeader("Basic abc")).toBeNull();
  });
});

describe("clampLimit", () => {
  it("defaults to 20", () => {
    expect(clampLimit(null)).toBe(20);
    expect(clampLimit("not-a-number")).toBe(20);
    expect(clampLimit("0")).toBe(20);
    expect(clampLimit("-5")).toBe(20);
  });
  it("caps at 100", () => {
    expect(clampLimit("500")).toBe(100);
  });
  it("passes valid values through", () => {
    expect(clampLimit("37")).toBe(37);
  });
});

describe("ackBodySchema", () => {
  it("accepts a valid batch", () => {
    const parsed = ackBodySchema.safeParse({
      results: [{ id: "86cce9ef-c21d-46e9-90d9-b79bb7992ea9", status: "synced", qbTxnId: "T1" }],
    });
    expect(parsed.success).toBe(true);
  });
  it("rejects invalid status / non-uuid id", () => {
    expect(ackBodySchema.safeParse({ results: [{ id: "x", status: "synced" }] }).success).toBe(false);
    expect(
      ackBodySchema.safeParse({
        results: [{ id: "86cce9ef-c21d-46e9-90d9-b79bb7992ea9", status: "weird" }],
      }).success
    ).toBe(false);
  });
});

// ─── Ack write-back ─────────────────────────────────────────────────────────

/**
 * Builds a Supabase mock that records all update/upsert calls. `queueRow` is
 * returned by the qb_sync_queue.select().eq().maybeSingle() lookup; pass null
 * to simulate a missing source row.
 */
function makeServiceMock(queueRow: any) {
  const calls: Array<{ table: string; op: string; payload: any }> = [];

  function tableApi(table: string) {
    const api: any = {
      _filter: {},
      select() {
        return api;
      },
      eq() {
        return api;
      },
      maybeSingle: vi.fn().mockResolvedValue({
        data: table === "qb_sync_queue" ? queueRow : null,
        error: null,
      }),
      update(payload: any) {
        calls.push({ table, op: "update", payload });
        // update(...).eq(...) resolves
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      },
      upsert(payload: any) {
        calls.push({ table, op: "upsert", payload });
        return Promise.resolve({ error: null });
      },
    };
    return api;
  }

  return {
    calls,
    client: { from: vi.fn((t: string) => tableApi(t)) } as any,
  };
}

const SALES_QUEUE_ROW = {
  id: "86cce9ef-c21d-46e9-90d9-b79bb7992ea9",
  event_type: "sales_receipt",
  payload: { eventType: "sales_receipt", localType: "order", localId: "ord-1" },
};

const VENDOR_QUEUE_ROW = {
  id: "40b002e7-db48-43c2-9b2d-ea492342803f",
  event_type: "vendor_bill",
  payload: { eventType: "vendor_bill", localType: "payout", localId: "pay-1" },
};

const REFUND_QUEUE_ROW = {
  id: "9f1b3c2d-7a4e-4c8b-9f2a-1d6e3b5c7a90",
  event_type: "refund_receipt",
  payload: { eventType: "refund_receipt", localType: "refund", localId: "ord-1" },
};

describe("applyAckResult — synced", () => {
  it("marks the queue row synced, upserts entity map, and writes back to orders", async () => {
    const { calls, client } = makeServiceMock(SALES_QUEUE_ROW);
    const ok = await applyAckResult(client, {
      id: SALES_QUEUE_ROW.id,
      status: "synced",
      qbType: "SalesReceipt",
      qbListId: "L1",
      qbTxnId: "TXN-9",
    });
    expect(ok).toBe(true);

    const queueUpdate = calls.find((c) => c.table === "qb_sync_queue" && c.op === "update");
    expect(queueUpdate?.payload.status).toBe("synced");
    expect(queueUpdate?.payload.processed_at).toBeTruthy();

    const map = calls.find((c) => c.table === "qb_entity_map");
    expect(map?.op).toBe("upsert");
    expect(map?.payload).toMatchObject({
      local_type: "order",
      local_id: "ord-1",
      qb_type: "SalesReceipt",
      qb_txnid: "TXN-9",
      qb_listid: "L1",
    });

    const orderWrite = calls.find((c) => c.table === "orders");
    expect(orderWrite?.payload).toMatchObject({
      qb_object_id: "TXN-9",
      qb_object_type: "SalesReceipt",
      qb_sync_status: "synced",
    });
    expect(orderWrite?.payload.qb_synced_at).toBeTruthy();
  });

  it("sales_receipt sets orders.qb_object_id", async () => {
    const { calls, client } = makeServiceMock(SALES_QUEUE_ROW);
    await applyAckResult(client, {
      id: SALES_QUEUE_ROW.id,
      status: "synced",
      qbType: "SalesReceipt",
      qbTxnId: "SR-100",
    });
    const orderWrite = calls.find((c) => c.table === "orders");
    expect(orderWrite?.payload.qb_object_id).toBe("SR-100");
    expect(orderWrite?.payload.qb_object_type).toBe("SalesReceipt");
  });

  it("refund_receipt does NOT overwrite orders.qb_object_id but still upserts the refund into qb_entity_map", async () => {
    const { calls, client } = makeServiceMock(REFUND_QUEUE_ROW);
    const ok = await applyAckResult(client, {
      id: REFUND_QUEUE_ROW.id,
      status: "synced",
      qbType: "RefundReceipt",
      qbTxnId: "RF-200",
    });
    expect(ok).toBe(true);

    // Order row is touched (synced timestamp) but its QB ids are NOT changed —
    // the original sales-receipt id must survive the refund ack.
    const orderWrite = calls.find((c) => c.table === "orders");
    expect(orderWrite).toBeDefined();
    expect(orderWrite?.payload.qb_sync_status).toBe("synced");
    expect(orderWrite?.payload.qb_synced_at).toBeTruthy();
    expect("qb_object_id" in orderWrite!.payload).toBe(false);
    expect("qb_object_type" in orderWrite!.payload).toBe(false);

    // The refund is still recorded separately in qb_entity_map under 'refund'.
    const map = calls.find((c) => c.table === "qb_entity_map");
    expect(map?.op).toBe("upsert");
    expect(map?.payload).toMatchObject({
      local_type: "refund",
      local_id: "ord-1",
      qb_type: "RefundReceipt",
      qb_txnid: "RF-200",
    });
  });

  it("writes vendor_bill back to instructor_payouts", async () => {
    const { calls, client } = makeServiceMock(VENDOR_QUEUE_ROW);
    const ok = await applyAckResult(client, {
      id: VENDOR_QUEUE_ROW.id,
      status: "synced",
      qbType: "Bill",
      qbTxnId: "BILL-3",
    });
    expect(ok).toBe(true);

    const payoutWrite = calls.find((c) => c.table === "instructor_payouts");
    expect(payoutWrite?.payload).toMatchObject({
      qb_object_id: "BILL-3",
      qb_object_type: "Bill",
      qb_sync_status: "synced",
    });
    expect(calls.find((c) => c.table === "orders")).toBeUndefined();
  });
});

describe("applyAckResult — error", () => {
  it("keeps the row for retry by storing the error, no write-back", async () => {
    const { calls, client } = makeServiceMock(SALES_QUEUE_ROW);
    const ok = await applyAckResult(client, {
      id: SALES_QUEUE_ROW.id,
      status: "error",
      error: "qbXML rejected",
    });
    expect(ok).toBe(true);

    const queueUpdate = calls.find((c) => c.table === "qb_sync_queue");
    expect(queueUpdate?.payload.status).toBe("error");
    expect(queueUpdate?.payload.last_error).toBe("qbXML rejected");
    // No source write-back / entity map on error.
    expect(calls.find((c) => c.table === "orders")).toBeUndefined();
    expect(calls.find((c) => c.table === "qb_entity_map")).toBeUndefined();
  });
});

describe("applyAckResult — missing source row", () => {
  it("returns false and does not throw when the queue row is absent", async () => {
    const { calls, client } = makeServiceMock(null);
    const ok = await applyAckResult(client, {
      id: "dd1c365a-2ddf-495a-8db9-cedc1d7fb0bc",
      status: "synced",
      qbTxnId: "T",
    });
    expect(ok).toBe(false);
    // Nothing written.
    expect(calls.length).toBe(0);
  });
});

describe("applyAckBatch", () => {
  it("counts successful updates and a missing row does not poison the batch", async () => {
    // First mock returns a real row, separate mock returns null; combine via
    // a from() that switches on the id is overkill — instead run two mocks.
    const present = makeServiceMock(SALES_QUEUE_ROW);
    const okCount = await applyAckBatch(present.client, [
      { id: SALES_QUEUE_ROW.id, status: "synced", qbTxnId: "T1" },
    ]);
    expect(okCount).toBe(1);

    const absent = makeServiceMock(null);
    const missCount = await applyAckBatch(absent.client, [
      { id: "6cdac5ac-077c-45f4-9e29-8e92bd97e37f", status: "synced", qbTxnId: "T2" },
    ]);
    expect(missCount).toBe(0);
  });
});
