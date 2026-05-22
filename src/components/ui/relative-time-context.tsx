"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * Coordinates the "now" tick for any number of <RelativeTime> instances
 * inside it. Without the provider each component owns its own
 * setInterval; with the provider one shared interval drives them all.
 *
 * Drop in once near a page root that contains many <RelativeTime>
 * children:
 *
 *   <RelativeTimeProvider>...</RelativeTimeProvider>
 *
 * Children automatically pick up the shared tick.
 */

interface RelativeTimeContextValue {
  /** Monotonic counter; changes every tick. Components subscribe by reading it. */
  tick: number;
}

const RelativeTimeContext = createContext<RelativeTimeContextValue | null>(null);

interface RelativeTimeProviderProps {
  /** Tick cadence in ms. Default 30s — matches the standalone fallback. */
  intervalMs?: number;
  children: React.ReactNode;
}

export function RelativeTimeProvider({ intervalMs = 30_000, children }: RelativeTimeProviderProps) {
  const [tick, setTick] = useState(0);
  // Stable callback identity so any future <RelativeTime> useEffect deps
  // don't churn unnecessarily.
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <RelativeTimeContext.Provider value={{ tick }}>{children}</RelativeTimeContext.Provider>
  );
}

/** Internal — used by <RelativeTime>. Returns the shared tick if a provider
 * exists, else null and the component falls back to its own interval. */
export function useRelativeTimeContext(): RelativeTimeContextValue | null {
  return useContext(RelativeTimeContext);
}
