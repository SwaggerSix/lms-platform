// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin → Learning Paths → Image: POST /api/paths/[id]/cover uploads an image
 * to the public course-images bucket under paths/<id>/ and sets
 * learning_paths.thumbnail_url; DELETE clears it. Admin only, images only
 * (type, magic bytes, 5MB), and only our own paths/ objects are ever deleted.
 */

const PATH = "22222222-2222-4222-8222-222222222222";
const BUCKET_URL = "https://proj.supabase.co/storage/v1/object/public/course-images/";

let actor: { id: string; role: string } | null;
let pathRow: { id: string; thumbnail_url: string | null } | null;
let rateOk = true;
let updates: Record<string, unknown>[];
const upload = vi.fn(async (_path: string, _body: unknown, _opts: unknown) => ({ error: null as null | { message: string } }));
const remove = vi.fn(async (_paths: string[]) => ({ error: null }));

function query() {
  const q: Record<string, unknown> = {};
  let pendingUpdate: Record<string, unknown> | null = null;
  for (const op of ["select", "eq"]) q[op] = () => q;
  q.update = (v: Record<string, unknown>) => {
    pendingUpdate = v;
    return q;
  };
  q.maybeSingle = async () => ({ data: pathRow, error: null });
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    if (pendingUpdate) updates.push(pendingUpdate);
    return Promise.resolve({ data: null, error: null }).then(res, rej);
  };
  return q;
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => query(),
    storage: {
      from: () => ({
        upload: (p: string, b: unknown, o: unknown) => upload(p, b, o),
        remove: (p: string[]) => remove(p),
        getPublicUrl: (p: string) => ({ data: { publicUrl: `${BUCKET_URL}${p}` } }),
      }),
    },
  }),
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
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: rateOk }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import { POST, DELETE } from "@/app/api/paths/[id]/cover/route";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function post(file?: File) {
  const fd = new FormData();
  if (file) fd.append("file", file);
  return POST(new NextRequest(`http://localhost/api/paths/${PATH}/cover`, { method: "POST", body: fd }), {
    params: Promise.resolve({ id: PATH }),
  });
}

function del() {
  return DELETE(new NextRequest(`http://localhost/api/paths/${PATH}/cover`, { method: "DELETE" }), {
    params: Promise.resolve({ id: PATH }),
  });
}

beforeEach(() => {
  actor = { id: "admin-1", role: "admin" };
  pathRow = { id: PATH, thumbnail_url: null };
  rateOk = true;
  updates = [];
  upload.mockClear();
  remove.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/paths/[id]/cover", () => {
  it("rejects a signed-out caller", async () => {
    actor = null;
    const res = await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects non-admins (instructors, managers, learners)", async () => {
    for (const role of ["instructor", "manager", "learner"]) {
      actor = { id: "u", role };
      const res = await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
      expect(res.status).toBe(403);
    }
    expect(upload).not.toHaveBeenCalled();
  });

  it("allows super admins", async () => {
    actor = { id: "sa", role: "super_admin" };
    const res = await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(201);
  });

  it("is rate limited", async () => {
    rateOk = false;
    const res = await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(429);
  });

  it("404s for an unknown path", async () => {
    pathRow = null;
    const res = await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(404);
    expect(upload).not.toHaveBeenCalled();
  });

  it("requires a file", async () => {
    const res = await post();
    expect(res.status).toBe(400);
  });

  it("refuses types other than JPEG/PNG/WebP/GIF", async () => {
    for (const [name, type] of [["x.svg", "image/svg+xml"], ["x.pdf", "application/pdf"], ["x.html", "text/html"]]) {
      const res = await post(new File(["<svg/>"], name, { type }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Unsupported image type/);
    }
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses files over 5MB", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(JPEG);
    const res = await post(new File([big], "big.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/5MB/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses content that doesn't match the claimed type", async () => {
    const res = await post(new File([PNG], "fake.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/does not match/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("stores under paths/<id>/ and saves the public URL on the path", async () => {
    const res = await post(new File([PNG], "cover.png", { type: "image/png" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    const objectPath = upload.mock.calls[0][0];
    expect(objectPath).toMatch(new RegExp(`^paths/${PATH}/\\d+-[a-z0-9]+\\.png$`));
    expect(body.url).toBe(`${BUCKET_URL}${objectPath}`);
    expect(updates).toHaveLength(1);
    expect(updates[0].thumbnail_url).toBe(body.url);
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes the previous uploaded path image, but never a static file or course cover", async () => {
    pathRow = { id: PATH, thumbnail_url: `${BUCKET_URL}paths/${PATH}/old.jpg` };
    await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    expect(remove).toHaveBeenCalledWith([`paths/${PATH}/old.jpg`]);

    remove.mockClear();
    pathRow = { id: PATH, thumbnail_url: "/images/paths/mosaic-certification.jpg" };
    await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    expect(remove).not.toHaveBeenCalled();

    pathRow = { id: PATH, thumbnail_url: `${BUCKET_URL}course-uuid/cover.jpg` };
    await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    expect(remove).not.toHaveBeenCalled();
  });

  it("returns 500 without saving when the upload fails", async () => {
    upload.mockResolvedValueOnce({ error: { message: "boom" } });
    const res = await post(new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(500);
    expect(updates).toHaveLength(0);
  });
});

describe("DELETE /api/paths/[id]/cover", () => {
  it("is admin only", async () => {
    actor = { id: "i", role: "instructor" };
    expect((await del()).status).toBe(403);
    actor = null;
    expect((await del()).status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it("clears the image and removes an uploaded object", async () => {
    pathRow = { id: PATH, thumbnail_url: `${BUCKET_URL}paths/${PATH}/old.jpg` };
    const res = await del();
    expect(res.status).toBe(200);
    expect(updates[0].thumbnail_url).toBeNull();
    expect(remove).toHaveBeenCalledWith([`paths/${PATH}/old.jpg`]);
  });

  it("clears a static image without touching storage", async () => {
    pathRow = { id: PATH, thumbnail_url: "/images/paths/mosaic-systems-training.jpg" };
    const res = await del();
    expect(res.status).toBe(200);
    expect(updates[0].thumbnail_url).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });
});
