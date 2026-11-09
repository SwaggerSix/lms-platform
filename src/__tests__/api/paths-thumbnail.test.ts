// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * /api/paths carries learning_paths.thumbnail_url: GET returns it, POST and
 * PATCH accept an https URL or a same-origin "/…" path and refuse anything
 * else, and replacing an uploaded image deletes the old object.
 */

const PATH = "22222222-2222-4222-8222-222222222222";
const BUCKET_URL = "https://proj.supabase.co/storage/v1/object/public/course-images/";

let actor: { id: string; role: string } | null;
let storedThumbnail: string | null;
let inserts: Record<string, unknown>[];
let updates: Record<string, unknown>[];
const remove = vi.fn(async (_p: string[]) => ({ error: null }));

const listedPaths = [
  { id: PATH, title: "Mosaic Certification", thumbnail_url: "/images/paths/mosaic-certification.jpg", items: [] },
  { id: "p2", title: "Mosaic Systems Training", thumbnail_url: "/images/paths/mosaic-systems-training.jpg", items: [] },
];

function query(table: string) {
  const q: Record<string, unknown> = {};
  let insertRow: Record<string, unknown> | null = null;
  let updateRow: Record<string, unknown> | null = null;
  for (const op of ["select", "eq", "in", "order", "delete"]) q[op] = () => q;
  q.insert = (v: Record<string, unknown>) => {
    insertRow = v;
    inserts.push(v);
    return q;
  };
  q.update = (v: Record<string, unknown>) => {
    updateRow = v;
    updates.push(v);
    return q;
  };
  const one = async () => {
    if (table === "users") return { data: { id: "u1", role: actor?.role }, error: null };
    if (insertRow) return { data: { id: PATH, ...insertRow }, error: null };
    if (updateRow) return { data: { id: PATH, thumbnail_url: storedThumbnail, ...updateRow }, error: null };
    return { data: { thumbnail_url: storedThumbnail }, error: null };
  };
  q.single = one;
  q.maybeSingle = one;
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    const data = table === "learning_paths" && !insertRow && !updateRow ? listedPaths : [];
    return Promise.resolve({ data, error: null }).then(res, rej);
  };
  return q;
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (t: string) => query(t),
    storage: { from: () => ({ remove: (p: string[]) => remove(p) }) },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: actor ? { id: "auth-1" } : null } }) },
  }),
}));
vi.mock("@/lib/tenants/tenant-queries", () => ({ getTenantScope: async () => null }));
vi.mock("@/lib/auth/authorize", () => ({
  authorize: async (...roles: string[]) => {
    if (!actor) return { authorized: false, error: "Not authenticated", status: 401 };
    if (actor.role !== "super_admin" && !roles.includes(actor.role)) {
      return { authorized: false, error: "Insufficient permissions", status: 403 };
    }
    return { authorized: true, user: { ...actor, organization_id: null } };
  },
}));

import { GET, POST, PATCH } from "@/app/api/paths/route";

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/paths", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  actor = { id: "admin-1", role: "admin" };
  storedThumbnail = null;
  inserts = [];
  updates = [];
  remove.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/paths", () => {
  it("returns each path's thumbnail_url", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((p: { thumbnail_url: string }) => p.thumbnail_url)).toEqual([
      "/images/paths/mosaic-certification.jpg",
      "/images/paths/mosaic-systems-training.jpg",
    ]);
  });
});

describe("POST /api/paths thumbnail_url", () => {
  it("saves a same-origin path", async () => {
    const res = await POST(req("POST", { title: "New", thumbnail_url: "/images/paths/x.jpg" }));
    expect(res.status).toBe(201);
    expect(inserts[0].thumbnail_url).toBe("/images/paths/x.jpg");
  });

  it("refuses a non-https or script URL", async () => {
    for (const bad of ["javascript:alert(1)", "http://example.com/x.jpg", "//evil.example/x.jpg", "data:image/png;base64,AA"]) {
      const res = await POST(req("POST", { title: "New", thumbnail_url: bad }));
      expect(res.status).toBe(400);
    }
    expect(inserts).toHaveLength(0);
  });
});

describe("PATCH /api/paths thumbnail_url", () => {
  it("sets an https URL", async () => {
    const res = await PATCH(req("PATCH", { id: PATH, thumbnail_url: " https://cdn.example.com/a.jpg " }));
    expect(res.status).toBe(200);
    expect(updates[0].thumbnail_url).toBe("https://cdn.example.com/a.jpg");
    expect((await res.json()).thumbnail_url).toBe("https://cdn.example.com/a.jpg");
  });

  it("clears with an empty string", async () => {
    storedThumbnail = "/images/paths/mosaic-certification.jpg";
    const res = await PATCH(req("PATCH", { id: PATH, thumbnail_url: "" }));
    expect(res.status).toBe(200);
    expect(updates[0].thumbnail_url).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("refuses an unsafe URL without updating", async () => {
    const res = await PATCH(req("PATCH", { id: PATH, thumbnail_url: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("deletes a replaced uploaded image from storage", async () => {
    storedThumbnail = `${BUCKET_URL}paths/${PATH}/old.png`;
    const res = await PATCH(req("PATCH", { id: PATH, thumbnail_url: "/images/paths/mosaic-certification.jpg" }));
    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledWith([`paths/${PATH}/old.png`]);
  });

  it("leaves the image alone when thumbnail_url is not sent", async () => {
    const res = await PATCH(req("PATCH", { id: PATH, title: "Renamed" }));
    expect(res.status).toBe(200);
    expect(updates[0]).not.toHaveProperty("thumbnail_url");
  });

  it("is admin only", async () => {
    actor = { id: "m", role: "manager" };
    const res = await PATCH(req("PATCH", { id: PATH, thumbnail_url: "/images/paths/x.jpg" }));
    expect(res.status).toBe(403);
  });
});
