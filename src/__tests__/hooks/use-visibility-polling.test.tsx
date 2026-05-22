import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useVisibilityPolling } from "@/hooks/use-visibility-polling";

function Harness({ poll, ...rest }: { poll: () => Promise<void> | void; intervalMs: number; backoffMs: number; backoffAfter: number }) {
  useVisibilityPolling({ poll, ...rest });
  return null;
}

describe("useVisibilityPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default to visible.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls poll on each interval tick", async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    render(<Harness poll={poll} intervalMs={1_000} backoffMs={10_000} backoffAfter={3} />);
    expect(poll).toHaveBeenCalledTimes(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(poll).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("backs off after the configured failure count", async () => {
    const poll = vi.fn().mockRejectedValue(new Error("boom"));
    render(<Harness poll={poll} intervalMs={1_000} backoffMs={10_000} backoffAfter={2} />);

    // First failure — still on normal cadence (1s).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(poll).toHaveBeenCalledTimes(1);

    // Second failure — failureCount now 2 = threshold; next tick uses backoff.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(poll).toHaveBeenCalledTimes(2);

    // After threshold reached, next interval is backoffMs (10s). Advance
    // by 1s — should NOT have called again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(poll).toHaveBeenCalledTimes(2);

    // Now advance to the backoff cadence — call number 3.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("returns to normal cadence after a successful poll", async () => {
    let shouldFail = true;
    const poll = vi.fn(async () => {
      if (shouldFail) throw new Error("boom");
    });
    render(<Harness poll={poll} intervalMs={1_000} backoffMs={10_000} backoffAfter={1} />);

    // First failure → threshold reached.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(poll).toHaveBeenCalledTimes(1);

    // Now in backoff. Flip to success and advance through the backoff
    // tick.
    shouldFail = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(poll).toHaveBeenCalledTimes(2);

    // Should be back to normal cadence — next tick at +1s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("pauses when document is hidden", async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    render(<Harness poll={poll} intervalMs={1_000} backoffMs={10_000} backoffAfter={3} />);

    // Tick once visible.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(poll).toHaveBeenCalledTimes(1);

    // Hide and tick — should NOT fire.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(poll).toHaveBeenCalledTimes(1);

    // Return to visible — immediate refresh fires.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      // Allow the microtask in the resume handler to run.
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("cleans up the timer on unmount", async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(
      <Harness poll={poll} intervalMs={1_000} backoffMs={10_000} backoffAfter={3} />
    );
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(poll).not.toHaveBeenCalled();
  });
});
