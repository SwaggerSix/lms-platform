import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin → eCommerce → Coupons: Edit, the Active/Inactive toggle and Delete.
 * PATCH re-applies the create rules to the coupon as it will be after the
 * change (percentage ≤ 100, unique code, product exists), never writes
 * current_uses, and is super_admin only. DELETE refuses a coupon that has been
 * used or that an order refers to, and suggests switching it off instead.
 */

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PRODUCT = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;
let actor: { id: string; role: string } | null;
let coupons: Row[];
let products: string[];
let orderRefs: string[];
let carts: { id: string; coupon_id: string | null }[];
let updates: Row[];

type Op = { op: string; args: unknown[] };

function resolve(table: string, ops: Op[]): { data: unknown; error: unknown; count?: number } {
  const arg = (op: string, i = 0) => ops.find((o) => o.op === op)?.args[i];
  const eqs = ops.filter((o) => o.op === "eq").map((o) => o.args as [string, unknown]);
  const neqs = ops.filter((o) => o.op === "neq").map((o) => o.args as [string, unknown]);
  const match = (r: Row) =>
    eqs.every(([c, v]) => r[c] === v) && neqs.every(([c, v]) => r[c] !== v);

  if (table === "coupons") {
    const upd = arg("update") as Row | undefined;
    if (upd) {
      updates.push(upd);
      const row = coupons.find(match);
      if (!row) return { data: null, error: { code: "PGRST116", message: "none" } };
      if (typeof upd.code === "string" && coupons.some((c) => c !== row && c.code === upd.code)) {
        return { data: null, error: { code: "23505", message: "duplicate" } };
      }
      Object.assign(row, upd);
      return { data: { ...row }, error: null };
    }
    if (ops.some((o) => o.op === "delete")) {
      const gone = coupons.filter(match);
      coupons = coupons.filter((c) => !match(c));
      return { data: gone.map((c) => ({ id: c.id })), error: null };
    }
    const row = coupons.find(match);
    return { data: row ? { ...row } : null, error: null };
  }
  if (table === "products") {
    const id = eqs.find(([c]) => c === "id")?.[1] as string;
    return { data: products.includes(id) ? { id } : null, error: null };
  }
  if (table === "orders") {
    const id = eqs.find(([c]) => c === "metadata->>coupon_id")?.[1];
    return { data: null, error: null, count: orderRefs.filter((r) => r === id).length };
  }
  if (table === "cart_items") {
    const upd = arg("update") as Row | undefined;
    const id = eqs.find(([c]) => c === "coupon_id")?.[1];
    if (upd) for (const c of carts) if (c.coupon_id === id) c.coupon_id = null;
    return { data: null, error: null };
  }
  return { data: null, error: null };
}

function query(table: string) {
  const ops: Op[] = [];
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq", "neq", "order", "limit", "update", "insert", "delete"]) {
    q[op] = (...args: unknown[]) => {
      ops.push({ op, args });
      return q;
    };
  }
  for (const op of ["single", "maybeSingle"]) q[op] = async () => resolve(table, ops);
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(resolve(table, ops)).then(res, rej);
  return q;
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => query(t) }),
}));
vi.mock("@/lib/auth/authorize", () => ({
  authorize: async (...roles: string[]) => {
    if (!actor) return { authorized: false, error: "Not authenticated", status: 401 };
    if (actor.role !== "super_admin" && !roles.includes(actor.role)) {
      return { authorized: false, error: "Insufficient permissions", status: 403 };
    }
    return { authorized: true, user: { ...actor, organization_id: null } };
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import { PATCH, DELETE } from "@/app/api/shop/coupons/[id]/route";

function patch(body: unknown, id = ID) {
  return PATCH(
    new NextRequest(`http://localhost/api/shop/coupons/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

function del(id = ID) {
  return DELETE(new NextRequest(`http://localhost/api/shop/coupons/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  actor = { id: "admin-1", role: "super_admin" };
  coupons = [
    {
      id: ID,
      code: "MOSAICGIFT",
      discount_type: "percentage",
      discount_value: "100.00",
      max_uses: 5,
      current_uses: 0,
      min_purchase: null,
      valid_from: null,
      valid_until: null,
      is_active: false,
      product_id: null,
    },
    {
      id: OTHER,
      code: "SAVE20",
      discount_type: "fixed",
      discount_value: "20.00",
      max_uses: null,
      current_uses: 3,
      min_purchase: null,
      valid_from: null,
      valid_until: null,
      is_active: true,
      product_id: null,
    },
  ];
  products = [PRODUCT];
  orderRefs = [];
  carts = [];
  updates = [];
});

describe("PATCH /api/shop/coupons/[id]", () => {
  it("is super_admin only", async () => {
    actor = { id: "a", role: "admin" };
    expect((await patch({ is_active: true })).status).toBe(403);
    actor = null;
    expect((await patch({ is_active: true })).status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it("switches an inactive coupon on (the row toggle)", async () => {
    const res = await patch({ is_active: true });
    expect(res.status).toBe(200);
    expect((await res.json()).is_active).toBe(true);
    expect(updates).toEqual([{ is_active: true }]);
  });

  it("edits code, max uses, dates and product, upper-casing the code", async () => {
    const res = await patch({
      code: " mosaicfree ",
      max_uses: 10,
      valid_until: "2026-12-31T23:00:00.000Z",
      product_id: PRODUCT,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("MOSAICFREE");
    expect(body.max_uses).toBe(10);
    expect(body.valid_until).toBe("2026-12-31T23:00:00.000Z");
    expect(body.product_id).toBe(PRODUCT);
  });

  it("clears the product limit and the max uses with null", async () => {
    coupons[0].product_id = PRODUCT;
    const res = await patch({ product_id: null, max_uses: null });
    expect(res.status).toBe(200);
    expect(updates[0]).toEqual({ product_id: null, max_uses: null });
  });

  it("refuses a percentage over 100, also when only the type changes", async () => {
    expect((await patch({ discount_value: 150 })).status).toBe(400);
    // SAVE20 is $20 fixed; making it a percentage keeps 20 → fine.
    expect((await patch({ discount_type: "percentage" }, OTHER)).status).toBe(200);
    coupons[1].discount_value = "150.00";
    coupons[1].discount_type = "fixed";
    const res = await patch({ discount_type: "percentage" }, OTHER);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/can't be more than 100/);
  });

  it("refuses a code another coupon already has", async () => {
    const res = await patch({ code: "save20" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already exists/);
    expect(updates).toHaveLength(0);
  });

  it("keeps its own code without a clash", async () => {
    expect((await patch({ code: "MOSAICGIFT", max_uses: 6 })).status).toBe(200);
  });

  it("refuses a product that doesn't exist", async () => {
    const res = await patch({ product_id: "44444444-4444-4444-8444-444444444444" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no longer exists/);
  });

  it("never writes current_uses", async () => {
    const res = await patch({ current_uses: 0, is_active: true }, OTHER);
    expect(res.status).toBe(200);
    expect(updates[0]).not.toHaveProperty("current_uses");
    expect(coupons[1].current_uses).toBe(3);
  });

  it("refuses an empty change, bad values, and unknown coupons", async () => {
    expect((await patch({})).status).toBe(400);
    expect((await patch({ current_uses: 9 })).status).toBe(400);
    expect((await patch({ code: "" })).status).toBe(400);
    expect((await patch({ max_uses: 0 })).status).toBe(400);
    expect((await patch({ discount_value: -1 })).status).toBe(400);
    expect((await patch({ is_active: true }, "not-a-uuid")).status).toBe(404);
    expect((await patch({ is_active: true }, "55555555-5555-4555-8555-555555555555")).status).toBe(404);
  });
});

describe("DELETE /api/shop/coupons/[id]", () => {
  it("is super_admin only", async () => {
    actor = { id: "a", role: "admin" };
    expect((await del()).status).toBe(403);
    expect(coupons).toHaveLength(2);
  });

  it("deletes an unused coupon and drops it from open carts", async () => {
    carts = [{ id: "c1", coupon_id: ID }];
    const res = await del();
    expect(res.status).toBe(200);
    expect(coupons.map((c) => c.id)).toEqual([OTHER]);
    expect(carts[0].coupon_id).toBeNull();
  });

  it("refuses a coupon that has been used, and suggests deactivating", async () => {
    const res = await del(OTHER);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Inactive/);
    expect(coupons).toHaveLength(2);
  });

  it("refuses a coupon an order refers to, even with no counted use", async () => {
    orderRefs = [ID];
    const res = await del();
    expect(res.status).toBe(409);
    expect(coupons).toHaveLength(2);
  });

  it("refuses when a use is claimed between the check and the delete", async () => {
    const original = coupons[0];
    // Simulate checkout taking a use after the current_uses read.
    let reads = 0;
    Object.defineProperty(original, "current_uses", {
      get: () => (reads++ === 0 ? 0 : 1),
      enumerable: true,
      configurable: true,
    });
    const res = await del();
    expect(res.status).toBe(409);
    expect(coupons.some((c) => c.id === ID)).toBe(true);
  });

  it("404s an unknown coupon", async () => {
    expect((await del("55555555-5555-4555-8555-555555555555")).status).toBe(404);
  });
});
