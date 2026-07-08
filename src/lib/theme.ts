/**
 * Theme (light/dark) handling — UX review §3.5.
 *
 * The preference persists in localStorage and resolves to a `dark` class on
 * <html> (Tailwind's class-based dark variant, see the @custom-variant in
 * globals.css). A pre-paint inline script in the root layout applies the
 * stored preference before hydration to avoid a flash of the wrong theme.
 */

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "lms-theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function resolveIsDark(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Persist the preference and toggle the `dark` class on <html>. */
export function applyThemePreference(pref: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  document.documentElement.classList.toggle("dark", resolveIsDark(pref));
}
