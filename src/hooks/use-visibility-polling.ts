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
  /**
   * Disable polling entirely when false. Use this for "poll only when
   * some condition holds" cases (e.g. while a sync is active) instead
   * of passing an infinity-ish intervalMs sentinel. Default true.
   */
  enabled?: boolean;
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
  enabled = true,
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
  // Track previous visibility across renders so we can detect the
  // hidden → visible transition and fire an immediate refresh.
  const prevVisibleRef = useRef(visible);

  useEffect(() => {
    // Effect now depends on `visible` (and `enabled`) so a tab focus
    // change OR an enabled-flag flip tears down the current timer
    // chain and rebuilds it. Conceptually cleaner than the ref-based
    // read: while hidden / disabled no timer runs at all; when visible
    // and enabled the chain runs normally.
    if (!enabled) return;
    const isPaused = pauseWhenHidden && !visible;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const runPoll = async () => {
      try {
        await pollRef.current();
        failuresRef.current = 0;
      } catch {
        failuresRef.current += 1;
      }
    };

    const schedule = () => {
      if (cancelled || isPaused) return;
      const interval = failuresRef.current >= backoffAfter ? backoffMs : intervalMs;
      timeoutId = setTimeout(async () => {
        await runPoll();
        schedule();
      }, interval);
    };

    // Hidden → visible transition: fire an immediate poll so the
    // operator doesn't wait an interval for fresh data. Then schedule
    // the regular chain.
    const becameVisible = !isPaused && prevVisibleRef.current === false && visible === true;
    prevVisibleRef.current = visible;

    if (becameVisible) {
      (async () => {
        await runPoll();
        schedule();
      })();
    } else {
      schedule();
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [intervalMs, backoffMs, backoffAfter, pauseWhenHidden, visible, enabled]);
}
