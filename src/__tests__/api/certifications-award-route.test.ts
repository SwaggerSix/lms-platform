import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/authorize", () => ({ authorize: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/email/sender", () => ({ sendEmail: vi.fn() }));

/**
 * The Award screen lists (GET), awards (POST) and revokes (DELETE) through one
 * route. A refactor once cut POST and DELETE out of the file, and Award
 * answered 405 in production; this keeps all three.
 */
describe("/api/certifications/award", () => {
  it("handles GET, POST and DELETE", async () => {
    const route = await import("@/app/api/certifications/award/route");
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect(typeof route.DELETE).toBe("function");
  });
});
