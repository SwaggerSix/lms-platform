/**
 * Naming convention for audit_logs.action across the codebase.
 *
 * Kept in lib/ (not the test file) so both the test-time scanner and
 * other callers — e.g. a runtime validator at the logAudit boundary —
 * can share a single source of truth.
 *
 * Conventions:
 *   - LEGACY_ACTIONS: bare verbs allowed for historical reasons
 *     (entity_type provides context).
 *   - DOTTED_ACTION_RE: dotted lowercase namespaces, e.g.
 *     "profile.preferences.update", "replay.cron_alerts.refresh-view".
 *     Hyphens are allowed inside segments since job names use them.
 *   - DOTTED_TEMPLATE_LITERAL_RE: template strings whose static prefix
 *     ends with a dot before the `${...}` interpolation, so the
 *     runtime value is still a valid dotted namespace.
 *
 * Snake_case (without a dot) and camelCase are NOT allowed.
 */

export const LEGACY_ACTIONS = new Set(["created", "updated", "deleted", "login", "export"]);

export const DOTTED_ACTION_RE = /^[a-z][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)+$/;

export const DOTTED_TEMPLATE_LITERAL_RE = /^`[a-z][a-z0-9_.-]*(\.[a-z0-9][a-z0-9_-]*)*\.\$\{[^}]+\}`$/;

/**
 * Returns true if `action` is a valid string-literal audit action
 * (legacy verb or dotted namespace). Use at the runtime boundary
 * (e.g. inside logAudit) to gate future calls.
 */
export function isValidAuditAction(action: string): boolean {
  return LEGACY_ACTIONS.has(action) || DOTTED_ACTION_RE.test(action);
}

/**
 * Returns true if `source` (a raw backtick-delimited template literal
 * source string, including the backticks) has a dotted prefix that
 * makes its runtime value safely dotted regardless of interpolation.
 */
export function isValidAuditTemplateLiteralSource(source: string): boolean {
  return DOTTED_TEMPLATE_LITERAL_RE.test(source);
}
