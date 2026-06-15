import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertInstructor, EXTERNAL_SOURCE } from "@/lib/integrations/partner-portal/sync";
import type { CanonicalInstructor } from "@/lib/integrations/partner-portal/types";

// ─────────────────────────────────────────────────────────────────
// In-memory fake of the Supabase service client, scoped to the small
// surface upsertInstructor() touches on the `users` table plus the
// auth admin API. upsertInstructor takes the client as an argument, so
// no module mocking is needed — we just hand it this fake.
// ─────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  [key: string]: unknown;
}

function makeServiceMock(initialUsers: UserRow[] = []) {
  const users = [...initialUsers];

  const createUser = vi.fn(async ({ email }: { email: string }) => ({
    data: { user: { id: `auth-${email}` } },
    error: null as { message: string } | null,
  }));
  const deleteUser = vi.fn(async () => ({}));

  const service = {
    auth: { admin: { createUser, deleteUser } },
    from(table: string) {
      if (table !== "users") throw new Error(`unexpected table: ${table}`);
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq(col: string, val: unknown) {
          filters.push([col, val]);
          return builder;
        },
        maybeSingle: async () => ({
          data: users.find((u) => filters.every(([c, v]) => u[c] === v)) ?? null,
          error: null,
        }),
        update(patch: Record<string, unknown>) {
          return {
            eq: async (col: string, val: unknown) => {
              const row = users.find((u) => u[col] === val);
              if (row) Object.assign(row, patch);
              return { error: null };
            },
          };
        },
        insert: async (row: Record<string, unknown>) => {
          users.push({ id: `user-${users.length + 1}`, ...row });
          return { error: null };
        },
      };
      return builder;
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: service as any, users, createUser, deleteUser };
}

function instructor(overrides: Partial<CanonicalInstructor> = {}): CanonicalInstructor {
  return {
    external_id: "portal-1",
    email: "Jane@Example.com",
    first_name: "Jane",
    last_name: "Doe",
    bio: "Subcontractor bio",
    avatar_url: "https://portal/avatar.png",
    status: "active",
    updated_at: "2026-06-15T00:00:00Z",
    ...overrides,
  };
}

describe("upsertInstructor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("provisions a full instructor account for a new subcontractor", async () => {
    const { service, users, createUser } = makeServiceMock();

    const res = await upsertInstructor(service, instructor(), "intg-1");

    expect(res.created).toBe(true);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(users).toHaveLength(1);
    const row = users[0];
    expect(row.role).toBe("instructor");
    expect(row.auth_id).toBe("auth-jane@example.com"); // email lowercased
    expect(row.email).toBe("jane@example.com");
    expect(row.external_source).toBe(EXTERNAL_SOURCE);
    expect(row.external_id).toBe("portal-1");
    expect(row.external_integration_id).toBe("intg-1");
    expect(row.status).toBe("active");
    expect((row.preferences as Record<string, unknown>).must_change_password).toBe(true);
  });

  it("adopts and promotes an existing learner matched by email (no new auth account)", async () => {
    const { service, users, createUser } = makeServiceMock([
      { id: "user-1", email: "jane@example.com", role: "learner", auth_id: "auth-existing" },
    ]);

    const res = await upsertInstructor(service, instructor(), "intg-1");

    expect(res.created).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe("instructor");
    expect(users[0].external_id).toBe("portal-1"); // now stamped with provenance
    expect(users[0].bio).toBe("Subcontractor bio");
  });

  it("updates a user already matched by external id without duplicating", async () => {
    const { service, users } = makeServiceMock([
      {
        id: "user-1",
        email: "old@example.com",
        role: "instructor",
        external_source: EXTERNAL_SOURCE,
        external_id: "portal-1",
      },
    ]);

    const res = await upsertInstructor(
      service,
      instructor({ email: "new@example.com", bio: "Updated bio" }),
      "intg-1"
    );

    expect(res.created).toBe(false);
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("new@example.com");
    expect(users[0].bio).toBe("Updated bio");
  });

  it("never demotes an existing admin to instructor", async () => {
    const { service, users } = makeServiceMock([
      { id: "user-1", email: "jane@example.com", role: "admin" },
    ]);

    await upsertInstructor(service, instructor(), "intg-1");

    expect(users[0].role).toBe("admin");
    // …but still stamps provenance so future syncs match by external id
    expect(users[0].external_id).toBe("portal-1");
  });

  it("maps an offboarded subcontractor to inactive status", async () => {
    const { service, users } = makeServiceMock();

    await upsertInstructor(service, instructor({ status: "inactive" }), "intg-1");

    expect(users[0].status).toBe("inactive");
  });
});
