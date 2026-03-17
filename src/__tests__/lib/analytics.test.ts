import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "@/lib/analytics/track";

describe("trackEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
  });

  it("sends POST request to /api/analytics", async () => {
    await trackEvent("page_view");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("includes event_type in request body", async () => {
    await trackEvent("course_enrolled");
    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.event_type).toBe("course_enrolled");
  });

  it("includes metadata when provided", async () => {
    await trackEvent("lesson_completed", { course_id: "c1", lesson_id: "l1" });
    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.metadata).toEqual({ course_id: "c1", lesson_id: "l1" });
  });

  it("sends undefined metadata when data is not provided", async () => {
    await trackEvent("page_view");
    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.metadata).toBeUndefined();
  });

  it("sets Content-Type header to application/json", async () => {
    await trackEvent("badge_earned");
    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("does not throw when fetch fails", async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error("Network error"));
    // Should silently swallow the error
    await expect(trackEvent("search_performed")).resolves.toBeUndefined();
  });

  it("does not throw when fetch returns error status", async () => {
    (globalThis.fetch as any).mockResolvedValue(new Response("error", { status: 500 }));
    await expect(trackEvent("course_started")).resolves.toBeUndefined();
  });

  it("works with all event types", async () => {
    const events = [
      "page_view",
      "course_enrolled",
      "course_started",
      "lesson_completed",
      "course_completed",
      "assessment_started",
      "assessment_submitted",
      "badge_earned",
      "certificate_downloaded",
      "discussion_posted",
      "message_sent",
      "ilt_registered",
      "document_viewed",
      "search_performed",
    ] as const;

    for (const event of events) {
      vi.clearAllMocks();
      await trackEvent(event);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    }
  });
});
