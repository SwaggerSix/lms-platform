"use client";

import { useEffect } from "react";
import { useBrandingStore } from "@/stores/branding-store";

/**
 * BrandProvider applies the branding CSS custom properties to the DOM
 * on mount, then refreshes them from the platform-wide branding saved in
 * platform_settings so every user sees the configured brand (the locally
 * cached config paints first to avoid a flash). Place in the root layout.
 */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const applyToDOM = useBrandingStore((s) => s.applyToDOM);
  const loadFromServer = useBrandingStore((s) => s.loadFromServer);

  useEffect(() => {
    applyToDOM();
    loadFromServer();
  }, [applyToDOM, loadFromServer]);

  return <>{children}</>;
}
