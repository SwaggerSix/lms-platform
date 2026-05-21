/**
 * Recursive deep-merge for the users.preferences JSON blob.
 *
 * Object values merge key-by-key at every depth; arrays and primitives
 * overwrite, so callers can clear lists by passing [] or delete a pref by
 * passing null. Used by PATCH /api/profile so a small nested toggle (e.g.
 * { ui_prefs: { hide_platform_audit: true } }) composes with existing
 * sibling keys instead of clobbering the whole preferences blob.
 */
export function deepMergePreferences(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(incoming)) {
    const cur = current[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      cur &&
      typeof cur === "object" &&
      !Array.isArray(cur)
    ) {
      out[k] = deepMergePreferences(
        cur as Record<string, unknown>,
        v as Record<string, unknown>
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}
