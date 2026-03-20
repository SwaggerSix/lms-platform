"use client";

import { useState } from "react";
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  RotateCcw,
  UserPlus,
  Users,
  Building2,
  CalendarDays,
  BookOpen,
  Award,
  Bell,
  Route,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";

// ── Types ──────────────────────────────────────────────────────────────────

interface RuleConditions {
  role?: string[];
  organization_id?: string[];
  hire_date_within_days?: number;
  job_title_contains?: string;
  completed_course_id?: string;
}

interface RuleAction {
  type: "enroll_course" | "enroll_path" | "assign_badge" | "send_notification";
  course_id?: string;
  path_id?: string;
  badge_id?: string;
  due_days?: number;
  notification_text?: string;
}

interface EnrollmentRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  conditions: RuleConditions;
  actions: RuleAction[];
  last_run_at: string | null;
  run_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface LogEntry {
  id: string;
  rule_id: string;
  user_id: string;
  action_type: string;
  action_target_id: string | null;
  status: "success" | "skipped" | "error";
  error_message: string | null;
  created_at: string;
  user?: { id: string; first_name: string; last_name: string; email: string };
}

interface SelectOption {
  id: string;
  title?: string;
  name?: string;
}

interface AutomationClientProps {
  initialRules: EnrollmentRule[];
  courses: SelectOption[];
  paths: SelectOption[];
  badges: SelectOption[];
  organizations: SelectOption[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { value: "user_created", label: "New User Created", icon: UserPlus },
  { value: "role_changed", label: "Role Changed", icon: Users },
  { value: "org_changed", label: "Organization Changed", icon: Building2 },
  { value: "hire_date", label: "Within N Days of Hire Date", icon: CalendarDays },
  { value: "course_completed", label: "Course Completed", icon: BookOpen },
  { value: "schedule", label: "Scheduled (Periodic)", icon: Clock },
  { value: "manual", label: "Manual Trigger Only", icon: Play },
] as const;

const ACTION_TYPES = [
  { value: "enroll_course", label: "Enroll in Course", icon: BookOpen },
  { value: "enroll_path", label: "Enroll in Learning Path", icon: Route },
  { value: "assign_badge", label: "Award Badge", icon: Award },
  { value: "send_notification", label: "Send Notification", icon: Bell },
] as const;

const ROLES = ["admin", "manager", "instructor", "learner"];

function getTriggerLabel(value: string): string {
  return TRIGGER_TYPES.find((t) => t.value === value)?.label ?? value;
}

function getActionLabel(value: string): string {
  return ACTION_TYPES.find((a) => a.value === value)?.label ?? value;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function conditionsSummary(conditions: RuleConditions, organizations: SelectOption[]): string {
  const parts: string[] = [];
  if (conditions.role?.length) parts.push(`Role: ${conditions.role.join(", ")}`);
  if (conditions.organization_id?.length) {
    const orgNames = conditions.organization_id.map((oid) => {
      const org = organizations.find((o) => o.id === oid);
      return org?.name ?? oid.slice(0, 8);
    });
    parts.push(`Org: ${orgNames.join(", ")}`);
  }
  if (conditions.hire_date_within_days) parts.push(`Hire date within ${conditions.hire_date_within_days}d`);
  if (conditions.job_title_contains) parts.push(`Title contains "${conditions.job_title_contains}"`);
  if (conditions.completed_course_id) parts.push("Completed specific course");
  return parts.length > 0 ? parts.join(" + ") : "No conditions (all users)";
}

// ── Empty action helper ────────────────────────────────────────────────────

function emptyAction(): RuleAction {
  return { type: "enroll_course" };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AutomationClient({
  initialRules,
  courses,
  paths,
  badges,
  organizations,
}: AutomationClientProps) {
  const toast = useToast();

  // State
  const [rules, setRules] = useState<EnrollmentRule[]>(initialRules);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTrigger, setFilterTrigger] = useState("");
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [editingRule, setEditingRule] = useState<EnrollmentRule | null>(null);
  const [detailRule, setDetailRule] = useState<EnrollmentRule | null>(null);
  const [detailLogs, setDetailLogs] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [matchPreview, setMatchPreview] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTriggerType, setFormTriggerType] = useState("user_created");
  const [formConditions, setFormConditions] = useState<RuleConditions>({});
  const [formActions, setFormActions] = useState<RuleAction[]>([emptyAction()]);
  const [formActive, setFormActive] = useState(true);

  // Filtered rules
  const filtered = rules.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrigger = !filterTrigger || r.trigger_type === filterTrigger;
    return matchesSearch && matchesTrigger;
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormTriggerType("user_created");
    setFormConditions({});
    setFormActions([emptyAction()]);
    setFormActive(true);
    setEditingRule(null);
    setMatchPreview(null);
  }

  function openCreateForm() {
    resetForm();
    setView("form");
  }

  function openEditForm(rule: EnrollmentRule) {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDescription(rule.description ?? "");
    setFormTriggerType(rule.trigger_type);
    setFormConditions(rule.conditions ?? {});
    setFormActions(rule.actions?.length ? rule.actions : [emptyAction()]);
    setFormActive(rule.is_active);
    setMatchPreview(null);
    setView("form");
  }

  async function openDetail(rule: EnrollmentRule) {
    setDetailRule(rule);
    setDetailLogs([]);
    setLoadingDetail(true);
    setView("detail");

    try {
      const res = await fetch(`/api/automation/rules/${rule.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailRule(data.rule);
        setDetailLogs(data.logs ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }

  // ── CRUD operations ──────────────────────────────────────────────────

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
      if (editingRule) {
        res = await fetch("/api/automation/rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingRule.id, ...payload }),
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

      if (editingRule) {
        setRules((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        toast.success("Rule updated");
      } else {
        setRules((prev) => [saved, ...prev]);
        toast.success("Rule created");
      }

      setView("list");
      resetForm();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(rule: EnrollmentRule) {
    try {
      const res = await fetch("/api/automation/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        toast.success(updated.is_active ? "Rule activated" : "Rule deactivated");
      }
    } catch {
      toast.error("Failed to toggle rule");
    }
  }

  async function handleDelete(rule: EnrollmentRule) {
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/automation/rules?id=${rule.id}`, { method: "DELETE" });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== rule.id));
        toast.success("Rule deleted");
        if (view === "detail") setView("list");
      }
    } catch {
      toast.error("Failed to delete rule");
    }
  }

  async function handleRunNow(rule: EnrollmentRule) {
    if (!confirm(`Run rule "${rule.name}" now for all matching users?`)) return;

    setRunning(rule.id);
    try {
      const res = await fetch(`/api/automation/rules/${rule.id}`, { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        toast.success(`Rule executed: ${result.matched} matched, ${result.executed} actions performed`);
        // Refresh the rule in our state
        const refreshRes = await fetch(`/api/automation/rules/${rule.id}`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setRules((prev) => prev.map((r) => (r.id === data.rule.id ? data.rule : r)));
          if (view === "detail") {
            setDetailRule(data.rule);
            setDetailLogs(data.logs ?? []);
          }
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to run rule");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRunning(null);
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

  // ── Form: Condition Builder ──────────────────────────────────────────

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
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  (formConditions.role ?? []).includes(role)
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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

  // ── Form: Action Builder ─────────────────────────────────────────────

  function renderActionBuilder() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Actions</h4>
          <button
            type="button"
            onClick={() => setFormActions((prev) => [...prev, emptyAction()])}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Views ────────────────────────────────────────────────────────────

  // Detail view
  if (view === "detail" && detailRule) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("list")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Rules
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                detailRule.is_active ? "bg-green-100" : "bg-gray-100"
              )}>
                <Zap className={cn("h-5 w-5", detailRule.is_active ? "text-green-600" : "text-gray-400")} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{detailRule.name}</h2>
                {detailRule.description && <p className="text-sm text-gray-500">{detailRule.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunNow(detailRule)}
                disabled={running === detailRule.id}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {running === detailRule.id ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Now
              </button>
              <button
                onClick={() => openEditForm(detailRule)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Edit2 className="h-4 w-4" /> Edit
              </button>
              <button
                onClick={() => handleDelete(detailRule)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>

          {/* Rule summary */}
          <div className="grid grid-cols-4 gap-4 border-b border-gray-100 p-6">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Trigger</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{getTriggerLabel(detailRule.trigger_type)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
              <span className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                detailRule.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              )}>
                {detailRule.is_active ? <CheckCircle className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                {detailRule.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Last Run</p>
              <p className="text-sm text-gray-900 mt-1">{formatDate(detailRule.last_run_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Total Runs</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{detailRule.run_count}</p>
            </div>
          </div>

          {/* Conditions & Actions */}
          <div className="grid grid-cols-2 gap-6 p-6">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Conditions</h4>
              <p className="text-sm text-gray-700">{conditionsSummary(detailRule.conditions, organizations)}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Actions</h4>
              <ul className="space-y-1">
                {detailRule.actions.map((action, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {getActionLabel(action.type)}
                    {action.course_id && ` - ${courses.find((c) => c.id === action.course_id)?.title ?? action.course_id.slice(0, 8)}`}
                    {action.path_id && ` - ${paths.find((p) => p.id === action.path_id)?.title ?? action.path_id.slice(0, 8)}`}
                    {action.badge_id && ` - ${badges.find((b) => b.id === action.badge_id)?.name ?? action.badge_id.slice(0, 8)}`}
                    {action.due_days && ` (due in ${action.due_days}d)`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Execution Logs */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900">Execution Log</h3>
          </div>

          {loadingDetail ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading logs...</div>
          ) : detailLogs.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No execution logs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-900">
                        {log.user ? `${log.user.first_name} ${log.user.last_name}` : log.user_id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-3 text-gray-700">{getActionLabel(log.action_type)}</td>
                      <td className="px-6 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          log.status === "success" && "bg-green-100 text-green-700",
                          log.status === "skipped" && "bg-yellow-100 text-yellow-700",
                          log.status === "error" && "bg-red-100 text-red-700"
                        )}>
                          {log.status === "success" && <CheckCircle className="h-3 w-3" />}
                          {log.status === "skipped" && <AlertTriangle className="h-3 w-3" />}
                          {log.status === "error" && <XCircle className="h-3 w-3" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {log.error_message ?? (log.action_target_id ? log.action_target_id.slice(0, 8) + "..." : "-")}
                      </td>
                      <td className="px-6 py-3 text-gray-500">{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Form view (create/edit)
  if (view === "form") {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("list"); resetForm(); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Rules
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900">
              {editingRule ? "Edit Rule" : "Create Automation Rule"}
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left",
                        formTriggerType === tt.value
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
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
                onClick={() => setFormActive(!formActive)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  formActive ? "bg-indigo-600" : "bg-gray-300"
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
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-indigo-800">Preview</h4>
                  {matchPreview !== null ? (
                    <p className="text-sm text-indigo-600 mt-1">
                      This rule would match approximately <strong>{matchPreview}</strong> user{matchPreview !== 1 ? "s" : ""}.
                    </p>
                  ) : (
                    <p className="text-xs text-indigo-500 mt-1">Click to estimate how many users match these conditions.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={loadingPreview}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loadingPreview ? "Counting..." : "Preview Match"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setView("list"); resetForm(); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List view (default) ──────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrollment Automation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create rules that automatically enroll users in courses, paths, or award badges based on triggers.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create Rule
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterTrigger}
          onChange={(e) => setFilterTrigger(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Triggers</option>
          {TRIGGER_TYPES.map((tt) => (
            <option key={tt.value} value={tt.value}>
              {tt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Rules</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{rules.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{rules.filter((r) => r.is_active).length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Inactive</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">{rules.filter((r) => !r.is_active).length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Executions</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{rules.reduce((s, r) => s + (r.run_count || 0), 0)}</p>
        </div>
      </div>

      {/* Rules table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-base font-semibold text-gray-600">No rules found</h3>
            <p className="text-sm text-gray-400 mt-1">Create your first automation rule to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trigger</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Conditions</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Run</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Runs</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openDetail(rule)}
                      className="font-medium text-gray-900 hover:text-indigo-600 text-left"
                    >
                      {rule.name}
                    </button>
                    {rule.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{rule.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{getTriggerLabel(rule.trigger_type)}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs max-w-[200px] truncate">
                    {conditionsSummary(rule.conditions, organizations)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                        rule.is_active
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {rule.is_active ? <CheckCircle className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                      {rule.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{formatDate(rule.last_run_at)}</td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{rule.run_count}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleRunNow(rule)}
                        disabled={running === rule.id}
                        title="Run Now"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                      >
                        {running === rule.id ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openDetail(rule)}
                        title="View Details"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditForm(rule)}
                        title="Edit"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        title="Delete"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
