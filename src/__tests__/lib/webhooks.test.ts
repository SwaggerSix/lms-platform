import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server client (settings read)
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock service client (webhook_deliveries write)
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

// Mock Teams bridge to avoid side effects
vi.mock("@/lib/webhooks/teams-bridge", () => ({
  dispatchTeamsNotification: vi.fn().mockResolvedValue(undefined),
}));

import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateClient = vi.mocked(createClient);
const mockCreateServiceClient = vi.mocked(createServiceClient);

/** Build a chainable Supabase mock that always resolves with `response`. */
function makeChainMock(response: any) {
  const chain: any = {};
  ["select", "eq", "insert", "update", "single"].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue(response);
  // insert returns a chainable that also supports .select().single()
  chain.insert = vi.fn().mockReturnValue(chain);
  return { from: vi.fn().mockReturnValue(chain) };
}

function mockSupabaseWithSetting(value: any) {
  // Server client: returns the platform_settings row
  mockCreateClient.mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: value ? { value } : null,
            error: null,
          }),
        }),
      }),
    }),
  } as any);

  // Service client: handles webhook_deliveries insert + update
  const deliveryId = "delivery-test-id";
  const serviceMock = {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: deliveryId },
            error: null,
          }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { attempts: 0, max_attempts: 4 },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
  mockCreateServiceClient.mockReturnValue(serviceMock as any);
}

describe("dispatchWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does nothing when no webhook setting exists", async () => {
    mockSupabaseWithSetting(null);
    await dispatchWebhook("course.created", { id: "c1" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does nothing when webhookUrl is not configured", async () => {
    mockSupabaseWithSetting({ webhookUrl: "" });
    await dispatchWebhook("course.created", { id: "c1" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fires fetch with correct URL and payload structure", async () => {
    mockSupabaseWithSetting({
      webhookUrl: "https://hooks.example.com/lms",
      webhookSecret: "test-secret",
      selectedWebhookEvents: ["course.created"],
    });

    await dispatchWebhook("course.created", { id: "c1" });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://hooks.example.com/lms");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.event).toBe("course.created");
    expect(body.data).toEqual({ id: "c1" });
    expect(body.timestamp).toBeTruthy();
  });

  it("sets correct headers including event type and signature", async () => {
    mockSupabaseWithSetting({
      webhookUrl: "https://hooks.example.com/lms",
      webhookSecret: "test-secret",
      selectedWebhookEvents: ["user.created"],
    });

    await dispatchWebhook("user.created", { user_id: "u1" });

    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.headers["X-Webhook-Event"]).toBe("user.created");
    expect(opts.headers["X-Webhook-Signature"]).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
  });

  it("skips dispatch when event is not in selectedWebhookEvents", async () => {
    mockSupabaseWithSetting({
      webhookUrl: "https://hooks.example.com/lms",
      webhookSecret: "test-secret",
      selectedWebhookEvents: ["course.created"],
    });

    await dispatchWebhook("badge.earned", { badge: "b1" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("dispatches when selectedWebhookEvents is not set (all events enabled)", async () => {
    mockSupabaseWithSetting({
      webhookUrl: "https://hooks.example.com/lms",
      webhookSecret: "test-secret",
    });

    await dispatchWebhook("enrollment.completed", { id: "e1" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles fetch failure gracefully without throwing", async () => {
    mockSupabaseWithSetting({
      webhookUrl: "https://hooks.example.com/lms",
      webhookSecret: "test-secret",
    });
    (globalThis.fetch as any).mockRejectedValue(new Error("Network error"));

    // Should not throw
    await expect(dispatchWebhook("course.updated", { id: "c1" })).resolves.toBeUndefined();
  });

  it("handles supabase error gracefully without throwing", async () => {
    mockCreateClient.mockRejectedValue(new Error("DB down"));

    await expect(
      dispatchWebhook("assessment.submitted", { id: "a1" })
    ).resolves.toBeUndefined();
  });
});
