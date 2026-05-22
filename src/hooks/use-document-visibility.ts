"use client";

import { useSyncExternalStore } from "react";
import { type ExternalStore } from "./use-external-store";

/**
 * Module-singleton store of `document.visibilityState === "visible"`.
 * One listener bound to visibilitychange drives every subscriber via
 * useSyncExternalStore — no matter how many components consume the
 * hook, the document only sees one handler.
 *
 * Returns true when the tab is visible, false when hidden. Server-side
 * renders see `true` deterministically (the most useful default for
 * "are we visible?" — SSR can't actually be hidden).
 */

let store: ExternalStore<boolean> | null = null;

function getStore(): ExternalStore<boolean> {
  if (store) return store;
  let value = typeof document !== "undefined" && document.visibilityState === "visible";
  const listeners = new Set<() => void>();
  store = {
    get: () => value,
    getServerSnapshot: () => true,
    set: (next) => {
      if (value === next) return;
      value = next;
      for (const l of Array.from(listeners)) l();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      store!.set(document.visibilityState === "visible");
    });
  }
  return store;
}

export function useDocumentVisibility(): boolean {
  const s = getStore();
  return useSyncExternalStore(s.subscribe, s.get, s.getServerSnapshot);
}

/** Test-only: reset the module singleton so unit tests start clean. */
export function __resetDocumentVisibilityStoreForTests(): void {
  store = null;
}
