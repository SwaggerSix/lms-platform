"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ResultLimitNotice } from "@/components/ui/result-limit-notice";
import { getHelp } from "@/lib/help-content";
import { TRIGGER_TYPES, type EnrollmentRule, type SelectOption } from "./automation-shared";
import RulesTable from "./rules-table";
import RuleForm from "./rule-form";
import RuleDetail from "./rule-detail";

interface AutomationClientProps {
  initialRules: EnrollmentRule[];
  totalRules?: number;
  courses: SelectOption[];
  paths: SelectOption[];
  badges: SelectOption[];
  organizations: SelectOption[];
}

export default function AutomationClient({
  initialRules,
  totalRules,
  courses,
  paths,
  badges,
  organizations,
}: AutomationClientProps) {
  const toast = useToast();

  const [rules, setRules] = useState<EnrollmentRule[]>(initialRules);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTrigger, setFilterTrigger] = useState("");
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [editingRule, setEditingRule] = useState<EnrollmentRule | null>(null);
  const [detailRule, setDetailRule] = useState<EnrollmentRule | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const filtered = rules.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrigger = !filterTrigger || r.trigger_type === filterTrigger;
    return matchesSearch && matchesTrigger;
  });

  function openCreateForm() {
    setEditingRule(null);
    setView("form");
  }

  function openEditForm(rule: EnrollmentRule) {
    setEditingRule(rule);
    setView("form");
  }

  function openDetail(rule: EnrollmentRule) {
    setDetailRule(rule);
    setView("detail");
  }

  function handleSaved(saved: EnrollmentRule, isNew: boolean) {
    if (isNew) {
      setRules((prev) => [saved, ...prev]);
    } else {
      setRules((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    }
    setEditingRule(null);
    setView("list");
  }

  function handleRuleUpdated(updated: EnrollmentRule) {
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDetailRule((prev) => (prev && prev.id === updated.id ? updated : prev));
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

  if (view === "detail" && detailRule) {
    return (
      <RuleDetail
        initialRule={detailRule}
        courses={courses}
        paths={paths}
        badges={badges}
        organizations={organizations}
        onBack={() => setView("list")}
        onEdit={openEditForm}
        onDelete={handleDelete}
        onRuleUpdated={handleRuleUpdated}
      />
    );
  }

  if (view === "form") {
    return (
      <RuleForm
        rule={editingRule}
        courses={courses}
        paths={paths}
        badges={badges}
        organizations={organizations}
        onCancel={() => {
          setEditingRule(null);
          setView("list");
        }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Enrollment Automation</h1>
            <InfoTooltip content={getHelp("admin.automation").details} label="About Automation" side="bottom" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Simple if-this-then-that rules — e.g. "when a new hire joins, enroll them in onboarding." For multi-step flows with branches and delays, use Workflows instead.
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          Create Rule
        </Button>
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
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterTrigger}
          onChange={(e) => setFilterTrigger(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
          <p className="text-2xl font-bold text-primary-600 mt-1">{rules.reduce((s, r) => s + (r.run_count || 0), 0)}</p>
        </div>
      </div>

      {/* Rules table */}
      <ResultLimitNotice shown={rules.length} total={totalRules ?? rules.length} noun="rules" className="mb-3" />

      <RulesTable
        rules={filtered}
        organizations={organizations}
        runningId={running}
        onOpenDetail={openDetail}
        onEdit={openEditForm}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onRunNow={handleRunNow}
      />
    </div>
  );
}
