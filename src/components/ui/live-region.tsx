"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";

/**
 * Global live-region announcer for screen readers (WCAG 4.1.3).
 * Usage: useLiveAnnounce().announce("3 results found")
 */
interface LiveRegionState {
  message: string;
  politeness: "polite" | "assertive";
  announce: (message: string, politeness?: "polite" | "assertive") => void;
}

export const useLiveAnnounce = create<LiveRegionState>((set) => ({
  message: "",
  politeness: "polite",
  announce: (message, politeness = "polite") => {
    // Clear first then set — forces re-announcement of identical messages
    set({ message: "", politeness });
    requestAnimationFrame(() => {
      set({ message, politeness });
    });
  },
}));

export function LiveRegion() {
  const { message, politeness } = useLiveAnnounce();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Polite region for non-urgent updates */}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {politeness === "polite" ? message : ""}
      </div>
      {/* Assertive region for urgent updates */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
      >
        {politeness === "assertive" ? message : ""}
      </div>
    </>
  );
}
