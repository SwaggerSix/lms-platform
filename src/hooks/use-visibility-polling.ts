"use client";

import { useEffect, useRef } from "react";
import { useDocumentVisibility } from "./use-document-visibility";

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

  // Single shared visibility store — all consumers of the polling hook
  // route through one document listener even if the page hosts many.
  const visible = useDocumentVisibility();
  // Mirror visibility into a ref so the effect's scheduled callback
  // reads the current value without re-running the effect on every
  // visibility toggle (which would tear down + recreate the timer
  // chain on every focus change).
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const interval = failuresRef.current >= backoffAfter ? backoffMs : intervalMs;
      timeoutId = setTimeout(async () => {
        if (!pauseWhenHidden || visibleRef.current) {
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

    schedule();
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [intervalMs, backoffMs, backoffAfter, pauseWhenHidden]);

  // Separate effect: fire an immediate poll when the tab becomes
  // visible again (so the operator doesn't wait an interval for
  // fresh data). Only triggers on the hidden → visible transition.
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    if (!pauseWhenHidden) return;
    if (prevVisibleRef.current === visible) return;
    prevVisibleRef.current = visible;
    if (visible) {
      (async () => {
        try {
          await pollRef.current();
          failuresRef.current = 0;
        } catch {
          failuresRef.current += 1;
        }
      })();
    }
  }, [visible, pauseWhenHidden]);
}
