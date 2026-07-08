"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  type ThemePreference,
  applyThemePreference,
  getStoredTheme,
} from "@/lib/theme";
import { useBrandingStore } from "@/stores/branding-store";

const CYCLE: ThemePreference[] = ["light", "dark", "system"];

const LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** Header button cycling the theme preference: light → dark → system. */
export default function ThemeToggle() {
  // Render the system icon until mounted so SSR and client markup agree.
  const [mounted, setMounted] = useState(false);
  const [pref, setPref] = useState<ThemePreference>("system");
  const applyBranding = useBrandingStore((s) => s.applyToDOM);

  useEffect(() => {
    const stored = getStoredTheme();
    setPref(stored);
    setMounted(true);
    // Belt and braces: re-apply on mount in case the pre-paint script was
    // blocked (e.g. by a CSP change) so users aren't stranded in the wrong
    // theme with no recourse but the toggle.
    applyThemePreference(stored);
  }, []);

  // While following the system preference, react to OS theme changes live.
  useEffect(() => {
    if (pref !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyThemePreference("system");
      applyBranding();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref, applyBranding]);

  const next = CYCLE[(CYCLE.indexOf(pref) + 1) % CYCLE.length];
  const Icon = ICONS[mounted ? pref : "system"];

  return (
    <button
      onClick={() => {
        setPref(next);
        applyThemePreference(next);
        // Re-derive the --brand-* shell variables for the new theme.
        applyBranding();
      }}
      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      aria-label={`Theme: ${LABELS[pref]}. Switch to ${LABELS[next]}`}
      title={`Theme: ${LABELS[pref]} (click for ${LABELS[next]})`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
