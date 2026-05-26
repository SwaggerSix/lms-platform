/**
 * Detector for the `as-any-audit` convention test. Extracted so the
 * codebase walk, the unit test, and the smoke test all share one
 * definition (per docs/conventions.md's three-layer pattern).
 *
 * `as unknown as T` double-casts are intentionally NOT counted: they
 * name a target shape and are the migration target for bare `as any`.
 */

export const AS_ANY_RE = /\bas any\b/;

/** True when a source line uses the bare `as any` escape hatch. */
export function isAsAnyLine(line: string): boolean {
  // A line that double-casts via `as unknown as T` is the sanctioned
  // narrowing form, not the escape hatch — skip the whole line.
  if (line.includes("as unknown as")) return false;
  return AS_ANY_RE.test(line);
}
