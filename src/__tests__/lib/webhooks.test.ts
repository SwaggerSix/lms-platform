import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock createClient from supabase/server
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

function mockSupabaseWithSetting(value: any) {
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
      selectedWebhookEvents: ["course.created"],
    });

    await dispatchWebhook("badge.earned", { badge: "b1" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("dispatches when selectedWebhookEvents is not set (all events enabled)", async () => {
    mockSupabaseWithSetting({
      webhookUrl: "https://hooks.example.com/lms",
    });

    await dispatchWebhook("enrollment.completed", { id: "e1" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles fetch failure gracefully without throwing", async () => {
    mockSupabaseWithSetting({
      webhookUrl: "https://hooks.example.com/lms",
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
