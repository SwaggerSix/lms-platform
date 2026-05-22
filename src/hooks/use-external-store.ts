"use client";

import { useEffect, useRef } from "react";

/**
 * Minimal subscriber-set primitive for the
 * `useSyncExternalStore` pattern. Lets a hook expose a stable
 * subscribe/getSnapshot pair without re-implementing the listener
 * bookkeeping each time.
 *
 *   const store = useExternalStore(0);
 *   useEffect(() => {
 *     const id = setInterval(() => store.set(store.get() + 1), 30_000);
 *     return () => clearInterval(id);
 *   }, [store]);
 *   const value = useSyncExternalStore(store.subscribe, store.get, store.get);
 *
 * The store's identity is stable across renders so consumers don't
 * tear down + rebuild their subscription on every parent render.
 */

export interface ExternalStore<T> {
  get: () => T;
  /** Returns the same snapshot on server / first hydration pass. */
  getServerSnapshot: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function useExternalStore<T>(initial: T): ExternalStore<T> {
  const valueRef = useRef<T>(initial);
  const listenersRef = useRef(new Set<() => void>());
  const storeRef = useRef<ExternalStore<T> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = {
      get: () => valueRef.current,
      getServerSnapshot: () => initial,
      set: (next: T) => {
        if (Object.is(valueRef.current, next)) return;
        valueRef.current = next;
        // Snapshot the set before broadcasting so a listener that
        // unsubscribes during the call doesn't mutate-while-iterate.
        for (const l of Array.from(listenersRef.current)) l();
      },
      subscribe: (listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    };
  }
  return storeRef.current;
}

/**
 * Convenience: an external store whose value increments on a fixed
 * interval. The interval starts when the hook mounts and stops on
 * unmount. Subscribers re-render on each tick via useSyncExternalStore.
 *
 * Returns the store; consumers call useSyncExternalStore(store.subscribe,
 * store.get, store.getServerSnapshot).
 */
export function useTickStore(intervalMs: number): ExternalStore<number> {
  const store = useExternalStore<number>(0);
  useEffect(() => {
    const id = setInterval(() => store.set(store.get() + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, store]);
  return store;
}
