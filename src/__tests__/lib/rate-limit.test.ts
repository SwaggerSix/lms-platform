import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and returns remaining = limit - 1", async () => {
    const result = await rateLimit("test-first", 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on successive requests", async () => {
    const key = "test-decrement";
    await rateLimit(key, 5, 60000);
    const second = await rateLimit(key, 5, 60000);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(3);
  });

  it("allows requests up to the limit", async () => {
    const key = "test-up-to-limit";
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      const result = await rateLimit(key, limit, 60000);
      expect(result.success).toBe(true);
    }
  });

  it("blocks requests when limit is exceeded", async () => {
    const key = "test-block";
    const limit = 2;
    await rateLimit(key, limit, 60000);
    await rateLimit(key, limit, 60000);
    const blocked = await rateLimit(key, limit, 60000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the time window expires", async () => {
    const key = "test-reset";
    const limit = 1;
    const windowMs = 1000;

    await rateLimit(key, limit, windowMs);
    // Should be blocked
    expect((await rateLimit(key, limit, windowMs)).success).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    // Should be allowed again
    const afterReset = await rateLimit(key, limit, windowMs);
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(0); // limit(1) - 1
  });

  it("tracks different keys independently", async () => {
    await rateLimit("key-a", 1, 60000);
    expect((await rateLimit("key-a", 1, 60000)).success).toBe(false);
    expect((await rateLimit("key-b", 1, 60000)).success).toBe(true);
  });

  it("uses default limit of 10 and window of 60000 when not specified", async () => {
    const key = "test-defaults";
    const result = await rateLimit(key);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9); // default limit 10 - 1
  });

  it("returns remaining 0 on the last allowed request", async () => {
    const key = "test-last-allowed";
    await rateLimit(key, 2, 60000);
    const last = await rateLimit(key, 2, 60000);
    expect(last.success).toBe(true);
    expect(last.remaining).toBe(0);
  });

  it("keeps blocking after multiple requests past the limit", async () => {
    const key = "test-keep-blocking";
    await rateLimit(key, 1, 60000);
    expect((await rateLimit(key, 1, 60000)).success).toBe(false);
    expect((await rateLimit(key, 1, 60000)).success).toBe(false);
    expect((await rateLimit(key, 1, 60000)).success).toBe(false);
  });
});
