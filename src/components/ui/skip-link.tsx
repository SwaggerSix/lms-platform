"use client";

/**
 * Skip-to-content link for keyboard/screen reader users (WCAG 2.4.1).
 * Visually hidden until focused via Tab key.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
