"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Edit2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  conditionsSummary,
  formatDate,
  getActionLabel,
  getTriggerLabel,
  type EnrollmentRule,
  type LogEntry,
  type SelectOption,
} from "./automation-shared";

interface RuleDetailProps {
  /** Rule as known by the list; refreshed from the API on mount. */
  initialRule: EnrollmentRule;
  courses: SelectOption[];
  paths: SelectOption[];
  badges: SelectOption[];
  organizations: SelectOption[];
  onBack: () => void;
  onEdit: (rule: EnrollmentRule) => void;
  onDelete: (rule: EnrollmentRule) => void;
  /** Keeps the parent's rules list in sync after a manual run. */
  onRuleUpdated: (rule: EnrollmentRule) => void;
}

export default function RuleDetail({
  initialRule,
  courses,
  paths,
  badges,
  organizations,
  onBack,
  onEdit,
  onDelete,
  onRuleUpdated,
}: RuleDetailProps) {
  const toast = useToast();
  const [rule, setRule] = useState<EnrollmentRule>(initialRule);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/automation/rules/${initialRule.id}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRule(data.rule);
          setLogs(data.logs ?? []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRule.id]);

  async function handleRunNow() {
    if (!confirm(`Run rule "${rule.name}" now for all matching users?`)) return;

    setRunning(true);
    try {
      const res = await fetch(`/api/automation/rules/${rule.id}`, { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        toast.success(`Rule executed: ${result.matched} matched, ${result.executed} actions performed`);
        // Refresh the rule and logs
        const refreshRes = await fetch(`/api/automation/rules/${rule.id}`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setRule(data.rule);
          setLogs(data.logs ?? []);
          onRuleUpdated(data.rule);
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to run rule");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to Rules
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              rule.is_active ? "bg-green-100" : "bg-gray-100"
            )}>
              <Zap className={cn("h-5 w-5", rule.is_active ? "text-green-600" : "text-gray-400")} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{rule.name}</h2>
              {rule.description && <p className="text-sm text-gray-500">{rule.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRunNow} disabled={running}>
              {running ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Now
            </Button>
            <Button variant="outline" onClick={() => onEdit(rule)}>
              <Edit2 className="h-4 w-4" /> Edit
            </Button>
            <Button variant="outline-destructive" onClick={() => onDelete(rule)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        {/* Rule summary */}
        <div className="grid grid-cols-4 gap-4 border-b border-gray-100 p-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Trigger</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{getTriggerLabel(rule.trigger_type)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
            <span className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              rule.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            )}>
              {rule.is_active ? <CheckCircle className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {rule.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Last Run</p>
            <p className="text-sm text-gray-900 mt-1">{formatDate(rule.last_run_at)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Total Runs</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{rule.run_count}</p>
          </div>
        </div>

        {/* Conditions & Actions */}
        <div className="grid grid-cols-2 gap-6 p-6">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Conditions</h4>
            <p className="text-sm text-gray-700">{conditionsSummary(rule.conditions, organizations)}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Actions</h4>
            <ul className="space-y-1">
              {rule.actions.map((action, i) => (
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

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading logs...</div>
        ) : logs.length === 0 ? (
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
                {logs.map((log) => (
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
