"use client";

import { CheckCircle, Edit2, Eye, Pause, Play, RotateCcw, Trash2, Zap } from "lucide-react";
import { cn } from "@/utils/cn";
import { EmptyState } from "@/components/ui/empty-state";
import {
  conditionsSummary,
  formatDate,
  getTriggerLabel,
  type EnrollmentRule,
  type SelectOption,
} from "./automation-shared";

interface RulesTableProps {
  /** Filtered rules. */
  rules: EnrollmentRule[];
  organizations: SelectOption[];
  /** Id of the rule currently being run manually, if any. */
  runningId: string | null;
  onOpenDetail: (rule: EnrollmentRule) => void;
  onEdit: (rule: EnrollmentRule) => void;
  onToggleActive: (rule: EnrollmentRule) => void;
  onDelete: (rule: EnrollmentRule) => void;
  onRunNow: (rule: EnrollmentRule) => void;
}

export default function RulesTable({
  rules,
  organizations,
  runningId,
  onOpenDetail,
  onEdit,
  onToggleActive,
  onDelete,
  onRunNow,
}: RulesTableProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {rules.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-10 w-10" aria-hidden="true" />}
          title="No rules found"
          description="Create your first automation rule to get started."
        />
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
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <button
                    onClick={() => onOpenDetail(rule)}
                    className="font-medium text-gray-900 hover:text-primary-600 text-left"
                  >
                    {rule.name}
                  </button>
                  {rule.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{rule.description}</p>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-600">{getTriggerLabel(rule.trigger_type)}</td>
                <td className="px-6 py-4 text-gray-500 text-xs max-w-[200px] truncate">
                  {conditionsSummary(rule.conditions, organizations)}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onToggleActive(rule)}
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
                      onClick={() => onRunNow(rule)}
                      disabled={runningId === rule.id}
                      title="Run Now"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-primary-50 hover:text-primary-600 disabled:opacity-50"
                    >
                      {runningId === rule.id ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      <span className="sr-only">Run {rule.name} now</span>
                    </button>
                    <button
                      onClick={() => onOpenDetail(rule)}
                      title="View Details"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View {rule.name}</span>
                    </button>
                    <button
                      onClick={() => onEdit(rule)}
                      title="Edit"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="sr-only">Edit {rule.name}</span>
                    </button>
                    <button
                      onClick={() => onDelete(rule)}
                      title="Delete"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete {rule.name}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
