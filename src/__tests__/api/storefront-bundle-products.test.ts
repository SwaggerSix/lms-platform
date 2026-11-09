import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin → Storefronts → Products: a product can be a bundle that sells a
 * learning path. Saving one checks the path (exists, not archived, has
 * courses), refuses a product that is both a course and a bundle, and unlinks
 * any single course when a product becomes a bundle.
 */

const PATH = "22222222-2222-4222-8222-222222222222";
const COURSE = "33333333-3333-4333-8333-333333333333";
const PRODUCT = "44444444-4444-4444-8444-444444444444";

let path: Record<string, unknown> | null;
const writes: { op: string; row: Record<string, unknown> }[] = [];

function query(table: string) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  let pending: { op: string; row: Record<string, unknown> } | null = null;
  Object.assign(q, {
    select: chain,
    eq: chain,
    neq: chain,
    order: chain,
    limit: chain,
    insert: (row: Record<string, unknown>) => {
      pending = { op: "insert", row };
      writes.push(pending);
      return q;
    },
    update: (row: Record<string, unknown>) => {
      pending = { op: "update", row };
      writes.push(pending);
      return q;
    },
    maybeSingle: async () => (table === "learning_paths" ? { data: path, error: null } : { data: null, error: null }),
    single: async () => ({ data: { id: PRODUCT, ...(pending?.row ?? {}) }, error: null }),
  });
  return q;
}

vi.mock("@/lib/auth/authorize", () => ({
  authorize: async () => ({ authorized: true, user: { id: "admin-1", role: "super_admin" } }),
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }));

import { POST, PUT } from "@/app/api/storefront/admin/[id]/products/route";

const ctx = { params: Promise.resolve({ id: "store-1" }) };

function send(method: "POST" | "PUT", body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/storefront/admin/store-1/products", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return method === "POST" ? POST(req, ctx) : PUT(req, ctx);
}

const bundle = { name: "Mosaic Certification Bundle", price: 599, learning_path_id: PATH };

beforeEach(() => {
  writes.length = 0;
  path = {
    id: PATH,
    title: "Mosaic Certification",
    status: "published",
    items: [
      { sequence_order: 2, course: { id: "c2", title: "MOS-210" } },
      { sequence_order: 1, course: { id: "c1", title: "MOS-100" } },
    ],
  };
});

describe("bundle products — admin validation", () => {
  it("creates a bundle linked to the learning path, with no single course", async () => {
    const res = await send("POST", bundle);
    expect(res.status).toBe(201);
    expect(writes[0].row).toMatchObject({ learning_path_id: PATH, course_id: null, price: 599 });
  });

  it("refuses a product that is both a course and a bundle", async () => {
    const res = await send("POST", { ...bundle, course_id: COURSE });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not both/);
    expect(writes).toHaveLength(0);
  });

  it("refuses a path that does not exist", async () => {
    path = null;
    const res = await send("POST", bundle);
    expect(res.status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("refuses an archived path", async () => {
    path = { ...path!, status: "archived" };
    const res = await send("POST", bundle);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/archived/);
  });

  it("refuses a path with no courses", async () => {
    path = { ...path!, items: [] };
    const res = await send("POST", bundle);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no courses/);
  });

  it("refuses a malformed path id", async () => {
    const res = await send("POST", { ...bundle, learning_path_id: "not-a-uuid" });
    expect(res.status).toBe(400);
  });

  it("turns an existing product into a bundle on edit", async () => {
    const res = await send("PUT", { product_id: PRODUCT, learning_path_id: PATH });
    expect(res.status).toBe(200);
    expect(writes[0]).toMatchObject({ op: "update", row: { learning_path_id: PATH, course_id: null } });
  });

  it("switching Bundle off just clears the path", async () => {
    const res = await send("PUT", { product_id: PRODUCT, learning_path_id: null });
    expect(res.status).toBe(200);
    expect(writes[0].row.learning_path_id).toBeNull();
    expect("course_id" in writes[0].row).toBe(false);
  });
});
