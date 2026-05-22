import {
  LEGACY_ACTIONS,
  DOTTED_ACTION_RE,
  DOTTED_TEMPLATE_LITERAL_RE,
} from "./action-convention";

export interface Offender {
  file: string;
  action: string;
}

/**
 * Scan one source file for `action: "..."` and `action: \`...\`` literals
 * and return any that don't match the audit-action naming convention.
 *
 * Pulled out of the convention test so the detection logic itself is
 * unit-testable — the test would otherwise only verify the live tree
 * is clean, not that a regression would be caught.
 *
 * Caller controls how `file` is reported (relative vs absolute); the
 * function treats it as an opaque identifier.
 */
export function findActionLiteralOffenders(
  file: string,
  source: string
): Offender[] {
  const offenders: Offender[] = [];

  const STRING_LITERAL = /action:\s*"([^"]+)"/g;
  const TEMPLATE_LITERAL = /action:\s*(`[^`]+`)/g;

  for (const m of source.matchAll(STRING_LITERAL)) {
    const v = m[1];
    if (LEGACY_ACTIONS.has(v) || DOTTED_ACTION_RE.test(v)) continue;
    offenders.push({ file, action: v });
  }
  for (const m of source.matchAll(TEMPLATE_LITERAL)) {
    const v = m[1];
    if (DOTTED_TEMPLATE_LITERAL_RE.test(v)) continue;
    // A template literal that contains no interpolation is just a
    // string-literal in different clothing; allow it if the stripped
    // body matches the legacy or dotted shape.
    const stripped = v.replace(/^`|`$/g, "");
    if (
      !stripped.includes("${") &&
      (LEGACY_ACTIONS.has(stripped) || DOTTED_ACTION_RE.test(stripped))
    ) {
      continue;
    }
    offenders.push({ file, action: v });
  }

  return offenders;
}
