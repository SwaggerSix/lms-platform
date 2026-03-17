import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and returns remaining = limit - 1", () => {
    const result = rateLimit("test-first", 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on successive requests", () => {
    const key = "test-decrement";
    rateLimit(key, 5, 60000);
    const second = rateLimit(key, 5, 60000);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(3);
  });

  it("allows requests up to the limit", () => {
    const key = "test-up-to-limit";
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      const result = rateLimit(key, limit, 60000);
      expect(result.success).toBe(true);
    }
  });

  it("blocks requests when limit is exceeded", () => {
    const key = "test-block";
    const limit = 2;
    rateLimit(key, limit, 60000);
    rateLimit(key, limit, 60000);
    const blocked = rateLimit(key, limit, 60000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the time window expires", () => {
    const key = "test-reset";
    const limit = 1;
    const windowMs = 1000;

    rateLimit(key, limit, windowMs);
    // Should be blocked
    expect(rateLimit(key, limit, windowMs).success).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    // Should be allowed again
    const afterReset = rateLimit(key, limit, windowMs);
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(0); // limit(1) - 1
  });

  it("tracks different keys independently", () => {
    rateLimit("key-a", 1, 60000);
    expect(rateLimit("key-a", 1, 60000).success).toBe(false);
    expect(rateLimit("key-b", 1, 60000).success).toBe(true);
  });

  it("uses default limit of 10 and window of 60000 when not specified", () => {
    const key = "test-defaults";
    const result = rateLimit(key);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9); // default limit 10 - 1
  });

  it("returns remaining 0 on the last allowed request", () => {
    const key = "test-last-allowed";
    rateLimit(key, 2, 60000);
    const last = rateLimit(key, 2, 60000);
    expect(last.success).toBe(true);
    expect(last.remaining).toBe(0);
  });

  it("keeps blocking after multiple requests past the limit", () => {
    const key = "test-keep-blocking";
    rateLimit(key, 1, 60000);
    expect(rateLimit(key, 1, 60000).success).toBe(false);
    expect(rateLimit(key, 1, 60000).success).toBe(false);
    expect(rateLimit(key, 1, 60000).success).toBe(false);
  });
});
