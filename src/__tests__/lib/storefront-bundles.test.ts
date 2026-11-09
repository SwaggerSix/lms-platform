import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Store bundles — fulfilment.
 *
 * A bundle order line carries a learning_path_id. Paying for it enrolls the
 * buyer in that path and in every course on it; a course bought alone and
 * inside the bundle is enrolled once; courses the buyer already holds are left
 * alone (upsert ignoreDuplicates), so a repeat delivery changes nothing.
 */

vi.mock("@/lib/email/sender", () => ({ sendEmail: vi.fn(async () => ({ success: true })) }));

import { bundlePathProblem, resolveOrderEntitlements } from "@/lib/storefront/bundles";
import { enrollOrderBuyer } from "@/lib/storefront/fulfillment";

const PATH = "path-mosaic";
const MOSAIC = ["mos-100", "mos-210", "mos-220", "mos-230", "mos-240"];

interface Upsert {
  table: string;
  rows: Record<string, unknown>[];
  options: unknown;
}

/**
 * A minimal Supabase stand-in: learning_path_items for the path, an optional
 * existing user, and an `enrollments` table that honours ignoreDuplicates on
 * (user_id, course_id) like Postgres ON CONFLICT DO NOTHING.
 */
function fakeService(opts: { existingUserId?: string | null; alreadyEnrolled?: string[] } = {}) {
  const upserts: Upsert[] = [];
  const enrollments = new Map<string, Record<string, unknown>>();
  for (const c of opts.alreadyEnrolled ?? []) {
    enrollments.set(`${opts.existingUserId}:${c}`, { course_id: c, status: "completed" });
  }
  const pathEnrollments = new Map<string, Record<string, unknown>>();
  const invite = vi.fn(async () => ({ data: { user: { id: "auth-new" } }, error: null }));

  function from(table: string) {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    let upsertRows: Record<string, unknown>[] | null = null;
    Object.assign(q, {
      select: chain,
      eq: chain,
      in: chain,
      order: chain,
      update: chain,
      upsert: (rows: Record<string, unknown> | Record<string, unknown>[], options: unknown) => {
        upsertRows = Array.isArray(rows) ? rows : [rows];
        upserts.push({ table, rows: upsertRows, options });
        const ignore = (options as { ignoreDuplicates?: boolean })?.ignoreDuplicates;
        for (const r of upsertRows) {
          if (table === "enrollments") {
            const key = `${r.user_id}:${r.course_id}`;
            if (!enrollments.has(key) || !ignore) enrollments.set(key, r);
          }
          if (table === "learning_path_enrollments") {
            const key = `${r.user_id}:${r.path_id}`;
            if (!pathEnrollments.has(key) || !ignore) pathEnrollments.set(key, r);
          }
        }
        return q;
      },
      maybeSingle: async () => {
        if (table === "users") return { data: opts.existingUserId ? { id: opts.existingUserId } : null, error: null };
        return { data: null, error: null };
      },
      single: async () => {
        if (table === "users" && upsertRows) return { data: { id: "user-new" }, error: null };
        return { data: null, error: null };
      },
      then: (resolve: (v: unknown) => unknown) =>
        resolve(
          table === "learning_path_items"
            ? {
                data: MOSAIC.map((course_id, i) => ({ path_id: PATH, course_id, sequence_order: i + 1 })),
                error: null,
              }
            : { data: null, error: null }
        ),
    });
    return q;
  }

  const service = { from, auth: { admin: { inviteUserByEmail: invite } } } as unknown as SupabaseClient;
  return { service, upserts, enrollments, pathEnrollments, invite };
}

const order = {
  id: "order-1",
  customer_email: "buyer@client.com",
  customer_name: "Pat Buyer",
  metadata: { storefront_slug: "gothamculture" },
  storefront_id: "store-1",
};
const bundleLine = { course_id: null, learning_path_id: PATH };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("resolveOrderEntitlements", () => {
  it("expands a bundle line to every course on its learning path", async () => {
    const { service } = fakeService();
    const result = await resolveOrderEntitlements(service, [bundleLine]);
    expect(result).toEqual({ courseIds: MOSAIC, pathIds: [PATH] });
  });

  it("collapses a course bought alone and inside the bundle into one", async () => {
    const { service } = fakeService();
    const result = await resolveOrderEntitlements(service, [
      { course_id: "mos-220", learning_path_id: null },
      bundleLine,
    ]);
    expect(result.courseIds).toHaveLength(5);
    expect(new Set(result.courseIds)).toEqual(new Set(MOSAIC));
  });

  it("leaves single-course orders exactly as before", async () => {
    const { service } = fakeService();
    const result = await resolveOrderEntitlements(service, [{ course_id: "c1" }]);
    expect(result).toEqual({ courseIds: ["c1"], pathIds: [] });
  });
});

describe("enrollOrderBuyer — bundle", () => {
  it("enrolls an existing buyer in all five courses and the path", async () => {
    const { service, enrollments, pathEnrollments, upserts } = fakeService({ existingUserId: "u1" });
    const status = await enrollOrderBuyer(service, order, [bundleLine]);

    expect(status).toBe("enrolled");
    expect([...enrollments.keys()].sort()).toEqual(MOSAIC.map((c) => `u1:${c}`).sort());
    expect([...pathEnrollments.keys()]).toEqual([`u1:${PATH}`]);
    for (const row of enrollments.values()) {
      // Must satisfy enrollments_status_check (enrolled|in_progress|completed|failed|expired).
      expect(row.status).toBe("enrolled");
      expect(row.storefront_id).toBe("store-1");
    }
    for (const u of upserts) {
      expect(u.options).toMatchObject({ ignoreDuplicates: true });
    }
  });

  it("is idempotent: a second delivery adds nothing", async () => {
    const { service, enrollments, pathEnrollments } = fakeService({ existingUserId: "u1" });
    await enrollOrderBuyer(service, order, [bundleLine]);
    const before = JSON.stringify([...enrollments.entries()]);
    await enrollOrderBuyer(service, order, [bundleLine]);
    expect(JSON.stringify([...enrollments.entries()])).toBe(before);
    expect(pathEnrollments.size).toBe(1);
  });

  it("keeps courses the buyer already owns and adds the rest", async () => {
    const { service, enrollments } = fakeService({ existingUserId: "u1", alreadyEnrolled: ["mos-100", "mos-210"] });
    await enrollOrderBuyer(service, order, [bundleLine]);
    expect(enrollments.size).toBe(5);
    // Existing progress is untouched, not reset to a fresh enrollment.
    expect(enrollments.get("u1:mos-100")).toMatchObject({ status: "completed" });
    expect(enrollments.get("u1:mos-240")).toMatchObject({ status: "enrolled" });
  });

  it("invites a new buyer and enrolls them in the whole bundle", async () => {
    const { service, enrollments, pathEnrollments, invite } = fakeService({ existingUserId: null });
    const status = await enrollOrderBuyer(service, order, [bundleLine]);
    expect(status).toBe("invited");
    expect(invite).toHaveBeenCalledWith("buyer@client.com", expect.anything());
    expect(enrollments.size).toBe(5);
    expect([...pathEnrollments.keys()]).toEqual([`user-new:${PATH}`]);
  });
});

describe("bundlePathProblem", () => {
  const path = { id: PATH, title: "Mosaic Certification", status: "published", courses: [{ id: "c1", title: "MOS-100" }] };

  it("accepts a draft or published path with courses", () => {
    expect(bundlePathProblem(path)).toBeNull();
    expect(bundlePathProblem({ ...path, status: "draft" })).toBeNull();
  });

  it("refuses a missing, archived or empty path", () => {
    expect(bundlePathProblem(null)).toMatch(/no longer exists/);
    expect(bundlePathProblem({ ...path, status: "archived" })).toMatch(/archived/);
    expect(bundlePathProblem({ ...path, courses: [] })).toMatch(/no courses/);
  });
});
