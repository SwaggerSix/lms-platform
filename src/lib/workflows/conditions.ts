/**
 * Workflow Condition Evaluator
 * Supports comparison operators and nested AND/OR logic groups.
 */

export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "in_list"
  | "not_in_list"
  | "is_empty"
  | "is_not_empty"
  | "regex_match";

export interface ConditionRule {
  field: string;
  operator: ComparisonOperator;
  value?: unknown;
}

export interface ConditionGroup {
  logic: "and" | "or";
  conditions: Array<ConditionRule | ConditionGroup>;
}

export type Condition = ConditionRule | ConditionGroup;

// ── Field path resolution ───────────────────────────────────────────────────

/**
 * Resolves a dot-separated path against a context object.
 * e.g. "user.role" against { user: { role: "admin" } } => "admin"
 */
export function resolveFieldPath(context: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ── Single-rule evaluation ──────────────────────────────────────────────────

function evaluateRule(rule: ConditionRule, context: Record<string, unknown>): boolean {
  const fieldValue = resolveFieldPath(context, rule.field);

  switch (rule.operator) {
    case "equals":
      return fieldValue === rule.value;

    case "not_equals":
      return fieldValue !== rule.value;

    case "contains": {
      if (typeof fieldValue === "string" && typeof rule.value === "string") {
        return fieldValue.toLowerCase().includes(rule.value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(rule.value);
      }
      return false;
    }

    case "greater_than": {
      const numField = Number(fieldValue);
      const numValue = Number(rule.value);
      if (isNaN(numField) || isNaN(numValue)) return false;
      return numField > numValue;
    }

    case "less_than": {
      const numField = Number(fieldValue);
      const numValue = Number(rule.value);
      if (isNaN(numField) || isNaN(numValue)) return false;
      return numField < numValue;
    }

    case "in_list": {
      if (!Array.isArray(rule.value)) return false;
      return rule.value.includes(fieldValue);
    }

    case "not_in_list": {
      if (!Array.isArray(rule.value)) return true;
      return !rule.value.includes(fieldValue);
    }

    case "is_empty":
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === "" ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case "is_not_empty":
      return (
        fieldValue !== null &&
        fieldValue !== undefined &&
        fieldValue !== "" &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case "regex_match": {
      if (typeof fieldValue !== "string" || typeof rule.value !== "string") return false;
      try {
        const regex = new RegExp(rule.value);
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

// ── Group / recursive evaluation ────────────────────────────────────────────

function isConditionGroup(c: Condition): c is ConditionGroup {
  return "logic" in c && "conditions" in c;
}

/**
 * Evaluate a condition (single rule or group with nested AND/OR logic)
 * against a context object.
 */
export function evaluateCondition(condition: Condition, context: Record<string, unknown>): boolean {
  if (isConditionGroup(condition)) {
    const results = condition.conditions.map((c) => evaluateCondition(c, context));
    if (condition.logic === "and") {
      return results.every(Boolean);
    }
    return results.some(Boolean);
  }

  return evaluateRule(condition, context);
}
