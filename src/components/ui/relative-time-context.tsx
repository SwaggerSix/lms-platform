"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

/**
 * Coordinates the "now" tick for any number of <RelativeTime> instances
 * inside it. Without the provider each component owns its own
 * setInterval; with the provider one shared interval drives them all.
 *
 * Subscribers use useSyncExternalStore so React handles the
 * subscribe/unsubscribe lifecycle correctly even across concurrent
 * renders — fixes the previous "void shared?.tick" trick that depended
 * on React's render-tracking heuristic.
 */

interface RelativeTimeStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
  /** Server-side renders see tick=0 deterministically. */
  getServerSnapshot: () => number;
}

const RelativeTimeContext = createContext<RelativeTimeStore | null>(null);

interface RelativeTimeProviderProps {
  /** Tick cadence in ms. Default 30s — matches the standalone fallback. */
  intervalMs?: number;
  children: React.ReactNode;
}

export function RelativeTimeProvider({ intervalMs = 30_000, children }: RelativeTimeProviderProps) {
  const tickRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => tickRef.current, []);
  const getServerSnapshot = useCallback(() => 0, []);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      // Snapshot the set to avoid mutation-during-iteration if a
      // listener unsubscribes itself during the broadcast.
      for (const listener of Array.from(listenersRef.current)) listener();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  // Store identity is stable across renders so consumers don't churn
  // their useSyncExternalStore subscriptions on every parent render.
  const storeRef = useRef<RelativeTimeStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = { subscribe, getSnapshot, getServerSnapshot };
  }

  return (
    <RelativeTimeContext.Provider value={storeRef.current}>
      {children}
    </RelativeTimeContext.Provider>
  );
}

/**
 * Subscribe to the shared tick. Returns the current tick counter when
 * a provider exists, or null otherwise. Components that get null fall
 * back to their own setInterval.
 */
export function useSharedRelativeTimeTick(): number | null {
  const store = useContext(RelativeTimeContext);
  // useSyncExternalStore must be called unconditionally. When there's
  // no store, we still call it with a no-op store so the hook count is
  // stable across renders.
  const noopStore = useRef<RelativeTimeStore>({
    subscribe: () => () => {},
    getSnapshot: () => 0,
    getServerSnapshot: () => 0,
  });
  const active = store ?? noopStore.current;
  const tick = useSyncExternalStore(active.subscribe, active.getSnapshot, active.getServerSnapshot);
  return store ? tick : null;
}
