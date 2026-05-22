"use client";

import { useEffect, useRef } from "react";

interface UseVisibilityPollingOptions {
  /** Function to invoke on each tick. Awaited; if it rejects, the failure counter increments. */
  poll: () => Promise<void> | void;
  /** Default cadence in ms when the poll is succeeding. */
  intervalMs: number;
  /** Cadence in ms after `backoffAfter` consecutive failures. */
  backoffMs: number;
  /** Failure count that triggers the backoff cadence. */
  backoffAfter: number;
  /** Pause polling when document.visibilityState !== "visible". Default true. */
  pauseWhenHidden?: boolean;
}

/**
 * Self-scheduling poll that backs off on consecutive failures and
 * pauses when the tab is hidden. Uses setTimeout (not setInterval) so
 * each tick can recompute its cadence from the current failure streak.
 *
 * The hook does NOT invoke poll() immediately on mount — callers are
 * expected to trigger their initial fetch separately (typically via a
 * useEffect that runs once). This keeps the hook a single concern.
 */
export function useVisibilityPolling({
  poll,
  intervalMs,
  backoffMs,
  backoffAfter,
  pauseWhenHidden = true,
}: UseVisibilityPollingOptions): void {
  const failuresRef = useRef(0);
  // Keep the latest poll() in a ref so changing closures don't re-trigger
  // the effect (which would tear down + rebuild the timer chain).
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const isHidden = () =>
      pauseWhenHidden &&
      typeof document !== "undefined" &&
      document.visibilityState !== "visible";

    const schedule = () => {
      if (cancelled) return;
      const interval = failuresRef.current >= backoffAfter ? backoffMs : intervalMs;
      timeoutId = setTimeout(async () => {
        if (!isHidden()) {
          try {
            await pollRef.current();
            failuresRef.current = 0;
          } catch {
            failuresRef.current += 1;
          }
        }
        schedule();
      }, interval);
    };

    const stop = () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = null;
    };

    const onVis = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        if (cancelled) {
          cancelled = false;
          // Immediate refresh on return so the user doesn't wait an
          // interval for fresh data.
          (async () => {
            try {
              await pollRef.current();
              failuresRef.current = 0;
            } catch {
              failuresRef.current += 1;
            }
            schedule();
          })();
        }
      } else {
        stop();
      }
    };

    schedule();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, [intervalMs, backoffMs, backoffAfter, pauseWhenHidden]);
}
