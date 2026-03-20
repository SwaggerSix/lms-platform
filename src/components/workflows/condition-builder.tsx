"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

type Operator =
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

interface ConditionRule {
  field: string;
  operator: Operator;
  value?: string;
}

interface ConditionGroup {
  logic: "and" | "or";
  conditions: Array<ConditionRule | ConditionGroup>;
}

interface ConditionBuilderProps {
  condition: Record<string, unknown> | undefined;
  onChange: (condition: ConditionGroup) => void;
}

const OPERATORS: Array<{ value: Operator; label: string; needsValue: boolean }> = [
  { value: "equals", label: "equals", needsValue: true },
  { value: "not_equals", label: "not equals", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "greater_than", label: "greater than", needsValue: true },
  { value: "less_than", label: "less than", needsValue: true },
  { value: "in_list", label: "in list", needsValue: true },
  { value: "not_in_list", label: "not in list", needsValue: true },
  { value: "is_empty", label: "is empty", needsValue: false },
  { value: "is_not_empty", label: "is not empty", needsValue: false },
  { value: "regex_match", label: "matches regex", needsValue: true },
];

const FIELD_SUGGESTIONS = [
  "user.role",
  "user.email",
  "user.job_title",
  "user.organization_id",
  "user.status",
  "enrollment.progress",
  "enrollment.status",
  "enrollment.course_id",
  "trigger.event_type",
  "trigger.source",
];

function isConditionGroup(c: unknown): c is ConditionGroup {
  return typeof c === "object" && c !== null && "logic" in c && "conditions" in c;
}

function parseCondition(raw: Record<string, unknown> | undefined): ConditionGroup {
  if (!raw) return { logic: "and", conditions: [] };
  if (isConditionGroup(raw)) return raw as ConditionGroup;
  // Maybe it's a single rule
  if ("field" in raw && "operator" in raw) {
    return { logic: "and", conditions: [raw as unknown as ConditionRule] };
  }
  return { logic: "and", conditions: [] };
}

export function ConditionBuilder({ condition, onChange }: ConditionBuilderProps) {
  const [group, setGroup] = useState<ConditionGroup>(() => parseCondition(condition));

  useEffect(() => {
    setGroup(parseCondition(condition));
  }, [condition]);

  function emitChange(updated: ConditionGroup) {
    setGroup(updated);
    onChange(updated);
  }

  function addRule() {
    emitChange({
      ...group,
      conditions: [...group.conditions, { field: "", operator: "equals", value: "" }],
    });
  }

  function addNestedGroup() {
    emitChange({
      ...group,
      conditions: [
        ...group.conditions,
        { logic: group.logic === "and" ? "or" : "and", conditions: [{ field: "", operator: "equals", value: "" }] },
      ],
    });
  }

  function updateRule(index: number, updates: Partial<ConditionRule>) {
    const updated = [...group.conditions];
    updated[index] = { ...updated[index], ...updates } as ConditionRule;
    emitChange({ ...group, conditions: updated });
  }

  function updateNestedGroup(index: number, nestedGroup: ConditionGroup) {
    const updated = [...group.conditions];
    updated[index] = nestedGroup;
    emitChange({ ...group, conditions: updated });
  }

  function removeCondition(index: number) {
    const updated = group.conditions.filter((_, i) => i !== index);
    emitChange({ ...group, conditions: updated });
  }

  function toggleLogic() {
    emitChange({ ...group, logic: group.logic === "and" ? "or" : "and" });
  }

  return (
    <div className="space-y-2">
      {/* Logic toggle */}
      {group.conditions.length > 1 && (
        <button
          type="button"
          onClick={toggleLogic}
          className={cn(
            "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide transition-colors",
            group.logic === "and"
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
          )}
        >
          {group.logic}
        </button>
      )}

      {/* Condition rows */}
      {group.conditions.map((cond, idx) => {
        if (isConditionGroup(cond)) {
          return (
            <div key={idx} className="ml-3 pl-3 border-l-2 border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Nested group</span>
                <button
                  onClick={() => removeCondition(idx)}
                  className="p-0.5 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <ConditionBuilder
                condition={cond as unknown as Record<string, unknown>}
                onChange={(updated) => updateNestedGroup(idx, updated)}
              />
            </div>
          );
        }

        const rule = cond as ConditionRule;
        const operatorDef = OPERATORS.find((o) => o.value === rule.operator);

        return (
          <div key={idx} className="flex items-start gap-1.5">
            {/* Field */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={rule.field}
                onChange={(e) => updateRule(idx, { field: e.target.value })}
                placeholder="field path"
                list="field-suggestions"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Operator */}
            <div className="relative">
              <select
                value={rule.operator}
                onChange={(e) => updateRule(idx, { operator: e.target.value as Operator })}
                className="appearance-none pl-2 pr-5 py-1.5 border border-gray-200 rounded-md text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>

            {/* Value */}
            {operatorDef?.needsValue !== false && (
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={rule.value || ""}
                  onChange={(e) => updateRule(idx, { value: e.target.value })}
                  placeholder="value"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            )}

            {/* Remove */}
            <button
              onClick={() => removeCondition(idx)}
              className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {/* Field suggestions datalist */}
      <datalist id="field-suggestions">
        {FIELD_SUGGESTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {/* Add buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={addRule}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Rule
        </button>
        <button
          type="button"
          onClick={addNestedGroup}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Group
        </button>
      </div>
    </div>
  );
}
