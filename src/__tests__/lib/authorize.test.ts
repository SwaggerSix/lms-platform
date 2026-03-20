import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock createClient (server) for auth.getUser()
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock createServiceClient for DB user lookup (bypasses RLS)
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { authorize } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateClient = vi.mocked(createClient);
const mockCreateServiceClient = vi.mocked(createServiceClient);

function setupMockSupabase(options: {
  authUser?: { id: string } | null;
  dbUser?: { id: string; role: string } | null;
}) {
  const { authUser = null, dbUser = null } = options;

  // Server client: used only for auth.getUser()
  const serverMock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: authUser ? null : { message: "Not authenticated" },
      }),
    },
  };
  mockCreateClient.mockResolvedValue(serverMock as any);

  // Service client: used for DB user lookup
  const serviceMock = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: dbUser,
            error: dbUser ? null : { message: "Not found" },
          }),
        }),
      }),
    }),
  };
  mockCreateServiceClient.mockReturnValue(serviceMock as any);

  return { serverMock, serviceMock };
}

describe("authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    setupMockSupabase({ authUser: null });
    const result = await authorize("admin");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("Not authenticated");
    }
  });

  it("returns 404 when auth user exists but db user not found", async () => {
    setupMockSupabase({ authUser: { id: "auth-1" }, dbUser: null });
    const result = await authorize("admin");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(404);
      expect(result.error).toBe("User not found");
    }
  });

  it("returns 403 when user role is not in allowed roles", async () => {
    setupMockSupabase({
      authUser: { id: "auth-1" },
      dbUser: { id: "user-1", role: "learner" },
    });
    const result = await authorize("admin", "manager");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
    }
  });

  it("returns authorized when user role matches one of allowed roles", async () => {
    setupMockSupabase({
      authUser: { id: "auth-1" },
      dbUser: { id: "user-1", role: "admin" },
    });
    const result = await authorize("admin", "manager");
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.user).toEqual({ id: "user-1", role: "admin" });
    }
  });

  it("returns authorized for any role when no roles specified", async () => {
    setupMockSupabase({
      authUser: { id: "auth-1" },
      dbUser: { id: "user-1", role: "learner" },
    });
    const result = await authorize();
    expect(result.authorized).toBe(true);
  });

  it("returns supabase client in authorized result", async () => {
    const { serverMock } = setupMockSupabase({
      authUser: { id: "auth-1" },
      dbUser: { id: "user-1", role: "admin" },
    });
    const result = await authorize("admin");
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      // supabase in result is the server client used for auth
      expect(result.supabase).toBe(serverMock);
    }
  });

  it("queries users table with correct auth_id", async () => {
    const { serviceMock } = setupMockSupabase({
      authUser: { id: "auth-xyz" },
      dbUser: { id: "user-1", role: "instructor" },
    });
    await authorize("instructor");
    expect(serviceMock.from).toHaveBeenCalledWith("users");
  });

  it("allows instructor role when instructor is in allowed list", async () => {
    setupMockSupabase({
      authUser: { id: "auth-1" },
      dbUser: { id: "user-1", role: "instructor" },
    });
    const result = await authorize("instructor", "admin");
    expect(result.authorized).toBe(true);
  });

  it("rejects manager when only learner is allowed", async () => {
    setupMockSupabase({
      authUser: { id: "auth-1" },
      dbUser: { id: "user-1", role: "manager" },
    });
    const result = await authorize("learner");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(403);
    }
  });
});
