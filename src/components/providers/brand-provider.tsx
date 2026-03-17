"use client";

import { useEffect } from "react";
import { useBrandingStore } from "@/stores/branding-store";

/**
 * BrandProvider applies the branding CSS custom properties to the DOM
 * on mount and whenever the config changes. Place in the root layout.
 */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const applyToDOM = useBrandingStore((s) => s.applyToDOM);

  useEffect(() => {
    applyToDOM();
  }, [applyToDOM]);

  return <>{children}</>;
}
