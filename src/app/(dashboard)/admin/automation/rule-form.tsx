"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  ACTION_TYPES,
  ROLES,
  TRIGGER_TYPES,
  type EnrollmentRule,
  type RuleAction,
  type RuleConditions,
  type SelectOption,
} from "./automation-shared";

function emptyAction(): RuleAction {
  return { type: "enroll_course" };
}

interface RuleFormProps {
  /** Non-null when editing; null when creating. */
  rule: EnrollmentRule | null;
  courses: SelectOption[];
  paths: SelectOption[];
  badges: SelectOption[];
  organizations: SelectOption[];
  onCancel: () => void;
  /** Called with the saved rule; the parent updates its list and returns to it. */
  onSaved: (rule: EnrollmentRule, isNew: boolean) => void;
}

export default function RuleForm({
  rule,
  courses,
  paths,
  badges,
  organizations,
  onCancel,
  onSaved,
}: RuleFormProps) {
  const toast = useToast();

  const [formName, setFormName] = useState(rule?.name ?? "");
  const [formDescription, setFormDescription] = useState(rule?.description ?? "");
  const [formTriggerType, setFormTriggerType] = useState(rule?.trigger_type ?? "user_created");
  const [formConditions, setFormConditions] = useState<RuleConditions>(rule?.conditions ?? {});
  const [formActions, setFormActions] = useState<RuleAction[]>(
    rule?.actions?.length ? rule.actions : [emptyAction()]
  );
  const [formActive, setFormActive] = useState(rule?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [matchPreview, setMatchPreview] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Rule name is required");
      return;
    }
    if (formActions.length === 0) {
      toast.error("At least one action is required");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        is_active: formActive,
        trigger_type: formTriggerType,
        conditions: formConditions,
        actions: formActions,
      };

      let res: Response;
      if (rule) {
        res = await fetch("/api/automation/rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rule.id, ...payload }),
        });
      } else {
        res = await fetch("/api/automation/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save rule");
        return;
      }

      const saved = await res.json();
      toast.success(rule ? "Rule updated" : "Rule created");
      onSaved(saved, !rule);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setLoadingPreview(true);
    setMatchPreview(null);
    try {
      // Fetch active user count matching conditions via a simple approach
      const params = new URLSearchParams();
      if (formConditions.role?.length) params.set("role", formConditions.role[0]);
      if (formConditions.organization_id?.length) params.set("organization_id", formConditions.organization_id[0]);

      const res = await fetch(`/api/users?status=active&limit=1&${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMatchPreview(data.total ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPreview(false);
    }
  }

  function updateCondition<K extends keyof RuleConditions>(key: K, value: RuleConditions[K]) {
    setFormConditions((prev) => {
      const next = { ...prev };
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function renderConditionBuilder() {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700">Conditions</h4>
        <p className="text-xs text-gray-500">Users must match ALL conditions to trigger the rule.</p>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Role is</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  const current = formConditions.role ?? [];
                  const next = current.includes(role)
                    ? current.filter((r) => r !== role)
                    : [...current, role];
                  updateCondition("role", next);
                }}
                aria-pressed={(formConditions.role ?? []).includes(role)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  (formConditions.role ?? []).includes(role)
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Organization is</label>
          <select
            multiple
            value={formConditions.organization_id ?? []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (o) => o.value);
              updateCondition("organization_id", selected);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Hold Cmd/Ctrl to select multiple</p>
        </div>

        {/* Job title contains */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Job title contains</label>
          <input
            type="text"
            value={formConditions.job_title_contains ?? ""}
            onChange={(e) => updateCondition("job_title_contains", e.target.value || undefined)}
            placeholder="e.g. Engineer, Manager"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Hire date within days */}
        {(formTriggerType === "hire_date" || formTriggerType === "schedule") && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Hire date within (days)</label>
            <input
              type="number"
              min={1}
              value={formConditions.hire_date_within_days ?? ""}
              onChange={(e) => updateCondition("hire_date_within_days", e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="30"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        )}

        {/* Completed course (for course_completed trigger) */}
        {formTriggerType === "course_completed" && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Completed course</label>
            <select
              value={formConditions.completed_course_id ?? ""}
              onChange={(e) => updateCondition("completed_course_id", e.target.value || undefined)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Select a course...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  function renderActionBuilder() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Actions</h4>
          <button
            type="button"
            onClick={() => setFormActions((prev) => [...prev, emptyAction()])}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-800"
          >
            <Plus className="h-3.5 w-3.5" /> Add Action
          </button>
        </div>

        {formActions.map((action, idx) => (
          <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">Action {idx + 1}</span>
              {formActions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setFormActions((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Action type */}
            <select
              value={action.type}
              onChange={(e) => {
                const newType = e.target.value as RuleAction["type"];
                setFormActions((prev) =>
                  prev.map((a, i) => (i === idx ? { type: newType } : a))
                );
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              {ACTION_TYPES.map((at) => (
                <option key={at.value} value={at.value}>
                  {at.label}
                </option>
              ))}
            </select>

            {/* Action-specific fields */}
            {action.type === "enroll_course" && (
              <>
                <select
                  value={action.course_id ?? ""}
                  onChange={(e) =>
                    setFormActions((prev) =>
                      prev.map((a, i) => (i === idx ? { ...a, course_id: e.target.value || undefined } : a))
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Select a course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Due date (days after trigger)</label>
                  <input
                    type="number"
                    min={1}
                    value={action.due_days ?? ""}
                    onChange={(e) =>
                      setFormActions((prev) =>
                        prev.map((a, i) =>
                          i === idx ? { ...a, due_days: e.target.value ? parseInt(e.target.value) : undefined } : a
                        )
                      )
                    }
                    placeholder="e.g. 30"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </>
            )}

            {action.type === "enroll_path" && (
              <select
                value={action.path_id ?? ""}
                onChange={(e) =>
                  setFormActions((prev) =>
                    prev.map((a, i) => (i === idx ? { ...a, path_id: e.target.value || undefined } : a))
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select a learning path...</option>
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}

            {action.type === "assign_badge" && (
              <select
                value={action.badge_id ?? ""}
                onChange={(e) =>
                  setFormActions((prev) =>
                    prev.map((a, i) => (i === idx ? { ...a, badge_id: e.target.value || undefined } : a))
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select a badge...</option>
                {badges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {action.type === "send_notification" && (
              <textarea
                value={action.notification_text ?? ""}
                onChange={(e) =>
                  setFormActions((prev) =>
                    prev.map((a, i) => (i === idx ? { ...a, notification_text: e.target.value } : a))
                  )
                }
                placeholder="Notification message..."
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Rules
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900">
            {rule ? "Edit Rule" : "Create Automation Rule"}
          </h2>
        </div>

        <div className="space-y-6 p-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Onboarding Enrollment for New Hires"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="What does this rule do?"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Trigger type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGER_TYPES.map((tt) => {
                const Icon = tt.icon;
                return (
                  <button
                    key={tt.value}
                    type="button"
                    onClick={() => setFormTriggerType(tt.value)}
                    aria-pressed={formTriggerType === tt.value}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left",
                      formTriggerType === tt.value
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={formActive}
              onClick={() => setFormActive(!formActive)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                formActive ? "bg-primary-600" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                  formActive ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {formActive ? "Active" : "Inactive"}
            </span>
          </div>

          <hr className="border-gray-200" />

          {/* Conditions */}
          {renderConditionBuilder()}

          <hr className="border-gray-200" />

          {/* Actions */}
          {renderActionBuilder()}

          <hr className="border-gray-200" />

          {/* Preview */}
          <div className="rounded-lg bg-primary-50 border border-primary-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-primary-800">Preview</h4>
                {matchPreview !== null ? (
                  <p className="text-sm text-primary-600 mt-1">
                    This rule would match approximately <strong>{matchPreview}</strong> user{matchPreview !== 1 ? "s" : ""}.
                  </p>
                ) : (
                  <p className="text-xs text-primary-500 mt-1">Click to estimate how many users match these conditions.</p>
                )}
              </div>
              <Button type="button" size="sm" onClick={handlePreview} disabled={loadingPreview}>
                {loadingPreview ? "Counting..." : "Preview Match"}
              </Button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
