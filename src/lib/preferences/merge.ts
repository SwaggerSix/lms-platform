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

/**
 * Diff two preference blobs to a pair of leaf-keyed objects suitable for
 * audit_logs.{old_values,new_values}. Walks recursively and flattens
 * nested keys with dot notation so the audit row records exactly what
 * changed without dumping the entire preferences JSON.
 *
 *   diffPreferences({ a: 1, ui: { theme: "light" } }, { a: 1, ui: { theme: "dark" } })
 *   → { changed: { "ui.theme": "dark" }, removed: { "ui.theme": "light" } }
 *
 * Arrays and primitives compare by JSON-stringified equality so two
 * arrays with the same contents don't produce a diff entry.
 */
export function diffPreferences(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = ""
): { changed: Record<string, unknown>; removed: Record<string, unknown> } {
  const changed: Record<string, unknown> = {};
  const removed: Record<string, unknown> = {};

  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k;
    const b = before?.[k];
    const a = after?.[k];
    const bothObjects =
      b && typeof b === "object" && !Array.isArray(b) &&
      a && typeof a === "object" && !Array.isArray(a);

    if (bothObjects) {
      const sub = diffPreferences(
        b as Record<string, unknown>,
        a as Record<string, unknown>,
        path
      );
      Object.assign(changed, sub.changed);
      Object.assign(removed, sub.removed);
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      if (a !== undefined) changed[path] = a;
      if (b !== undefined) removed[path] = b;
    }
  }

  return { changed, removed };
}
