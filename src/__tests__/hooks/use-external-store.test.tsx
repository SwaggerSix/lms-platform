import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { useExternalStore, useTickStore } from "@/hooks/use-external-store";

function TickReader({ intervalMs, onValue }: { intervalMs: number; onValue: (n: number) => void }) {
  const store = useTickStore(intervalMs);
  const value = useSyncExternalStore(store.subscribe, store.get, store.getServerSnapshot);
  onValue(value);
  return null;
}

function StoreReader({ initial, onStore }: { initial: number; onStore: (s: ReturnType<typeof useExternalStore<number>>) => void }) {
  const store = useExternalStore<number>(initial);
  onStore(store);
  return null;
}

describe("useTickStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at 0 and increments on each interval", async () => {
    const seen: number[] = [];
    render(<TickReader intervalMs={1_000} onValue={(n) => seen.push(n)} />);
    // Initial render → seen[0] = 0.
    expect(seen.at(-1)).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(seen.at(-1)).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    // Three more ticks at 1s cadence.
    expect(seen.at(-1)).toBe(4);
  });

  it("clears the interval on unmount", async () => {
    const seen: number[] = [];
    const { unmount } = render(<TickReader intervalMs={1_000} onValue={(n) => seen.push(n)} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(seen.at(-1)).toBe(1);
    unmount();
    const beforeUnmount = seen.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    // No more renders after unmount.
    expect(seen.length).toBe(beforeUnmount);
  });

  it("respects changes to intervalMs by restarting the timer", async () => {
    const seen: number[] = [];
    const { rerender } = render(
      <TickReader intervalMs={1_000} onValue={(n) => seen.push(n)} />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(seen.at(-1)).toBe(1);
    rerender(<TickReader intervalMs={5_000} onValue={(n) => seen.push(n)} />);
    // After rerender with new interval, advancing by 1s should NOT tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    // The last observed value should still be 1 (rerender may push another
    // identical 1 onto the array since the component re-rendered).
    expect(seen.filter((n) => n > 1)).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(seen.at(-1)).toBe(2);
  });
});

describe("useExternalStore", () => {
  it("returns a stable store identity across renders", () => {
    const stores: Array<ReturnType<typeof useExternalStore<number>>> = [];
    const { rerender } = render(<StoreReader initial={0} onStore={(s) => stores.push(s)} />);
    rerender(<StoreReader initial={0} onStore={(s) => stores.push(s)} />);
    rerender(<StoreReader initial={0} onStore={(s) => stores.push(s)} />);
    expect(stores).toHaveLength(3);
    expect(stores[1]).toBe(stores[0]);
    expect(stores[2]).toBe(stores[0]);
  });

  it("broadcasts set() to subscribers", () => {
    const stores: Array<ReturnType<typeof useExternalStore<number>>> = [];
    render(<StoreReader initial={0} onStore={(s) => stores.push(s)} />);
    const store = stores[0];
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    store.set(1);
    store.set(2);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()).toBe(2);
    unsub();
    store.set(3);
    expect(listener).toHaveBeenCalledTimes(2); // no new calls after unsub
  });

  it("Object.is-equality short-circuits redundant set()s", () => {
    const stores: Array<ReturnType<typeof useExternalStore<number>>> = [];
    render(<StoreReader initial={42} onStore={(s) => stores.push(s)} />);
    const store = stores[0];
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(42); // no change → no broadcast
    store.set(42);
    expect(listener).toHaveBeenCalledTimes(0);
    store.set(43);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
