"use client";

import { createContext, useContext, useMemo, useRef, useSyncExternalStore } from "react";
import { useTickStore, type ExternalStore } from "@/hooks/use-external-store";

/**
 * Coordinates the "now" tick for any number of <RelativeTime> instances
 * inside it. Without the provider each component owns its own
 * setInterval; with the provider one shared interval drives them all.
 *
 * The provider stands up a tick store via the reusable useTickStore
 * helper (src/hooks/use-external-store.ts). Subscribers use
 * useSyncExternalStore for proper concurrent-render handling.
 */

const RelativeTimeContext = createContext<ExternalStore<number> | null>(null);

interface RelativeTimeProviderProps {
  /** Tick cadence in ms. Default 30s — matches the standalone fallback. */
  intervalMs?: number;
  children: React.ReactNode;
}

export function RelativeTimeProvider({ intervalMs = 30_000, children }: RelativeTimeProviderProps) {
  const store = useTickStore(intervalMs);
  return <RelativeTimeContext.Provider value={store}>{children}</RelativeTimeContext.Provider>;
}

/**
 * Subscribe to the shared tick. Returns the current tick counter when
 * a provider exists, or null otherwise. Components that get null fall
 * back to their own setInterval.
 */
export function useSharedRelativeTimeTick(): number | null {
  const store = useContext(RelativeTimeContext);
  // useSyncExternalStore must be called unconditionally. When there's
  // no store we hand it a noop with stable identity per render so the
  // hook count stays consistent.
  const noopStoreRef = useRef<ExternalStore<number>>({
    get: () => 0,
    getServerSnapshot: () => 0,
    set: () => {},
    subscribe: () => () => {},
  });
  const active = store ?? noopStoreRef.current;
  const tick = useSyncExternalStore(active.subscribe, active.get, active.getServerSnapshot);
  // useMemo to avoid changing the returned value when both args are
  // the same — keeps consumers of "is there a provider" stable.
  return useMemo(() => (store ? tick : null), [store, tick]);
}
