"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Ban,
  GitBranch,
  Zap,
  Timer,
  Repeat,
  Filter,
} from "lucide-react";
import { cn } from "@/utils/cn";

interface StepLog {
  id: string;
  run_id: string;
  step_id: string;
  status: string;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  workflow_steps: {
    step_type: string;
    step_config: Record<string, unknown>;
  } | null;
}

interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: string;
  trigger_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  step_logs: StepLog[];
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  running: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50" },
  completed: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  cancelled: { icon: Ban, color: "text-gray-600", bg: "bg-gray-50" },
  pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
  skipped: { icon: AlertTriangle, color: "text-gray-400", bg: "bg-gray-50" },
};

const stepTypeIcons: Record<string, typeof Zap> = {
  condition: GitBranch,
  action: Zap,
  delay: Timer,
  branch: GitBranch,
  loop: Repeat,
  filter: Filter,
};

function formatDuration(start: string, end: string | null): string {
  if (!end) return "ongoing";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default function WorkflowRunsClient({
  workflow,
  initialRuns,
}: {
  workflow: { id: string; name: string };
  initialRuns: WorkflowRun[];
}) {
  const [runs] = useState(initialRuns);
  const [expandedRun, setExpandedRun] = useState<string | null>(
    initialRuns.length > 0 ? initialRuns[0].id : null
  );
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = runs.filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/admin/workflows/${workflow.id}`}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Run History
          </h1>
          <p className="text-sm text-gray-500">{workflow.name}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-sm text-gray-500">{filtered.length} runs</span>
      </div>

      {/* Runs */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="font-medium">No runs yet</p>
          <p className="text-sm mt-1">Run the workflow to see execution history here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((run) => {
            const cfg = statusConfig[run.status] || statusConfig.running;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedRun === run.id;

            return (
              <div
                key={run.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Run header */}
                <button
                  onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg.bg)}>
                    <StatusIcon className={cn("w-4 h-4", cfg.color, run.status === "running" && "animate-spin")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      Run <span className="font-mono text-xs text-gray-500">{run.id.slice(0, 8)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(run.started_at).toLocaleString()} &middot;{" "}
                      {formatDuration(run.started_at, run.completed_at)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-full capitalize",
                      cfg.bg,
                      cfg.color
                    )}
                  >
                    {run.status}
                  </span>
                  <div className="text-xs text-gray-400">
                    {run.step_logs.length} steps
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                    {/* Error message */}
                    {run.error_message && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
                        <strong>Error:</strong> {run.error_message}
                      </div>
                    )}

                    {/* Trigger data */}
                    {Object.keys(run.trigger_data).length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Trigger Data
                        </h4>
                        <pre className="p-3 bg-gray-100 rounded-lg text-xs text-gray-700 overflow-x-auto font-mono">
                          {JSON.stringify(run.trigger_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Step logs */}
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Step Execution
                    </h4>
                    {run.step_logs.length === 0 ? (
                      <p className="text-sm text-gray-400">No step logs</p>
                    ) : (
                      <div className="space-y-2">
                        {run.step_logs.map((log, idx) => {
                          const logCfg = statusConfig[log.status] || statusConfig.pending;
                          const LogIcon = logCfg.icon;
                          const stepType = log.workflow_steps?.step_type || "unknown";
                          const StepIcon = stepTypeIcons[stepType] || Zap;
                          const actionLabel =
                            (log.workflow_steps?.step_config?.action_type as string) ||
                            stepType;

                          return (
                            <div
                              key={log.id}
                              className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100"
                            >
                              {/* Step number + connector */}
                              <div className="flex flex-col items-center">
                                <div
                                  className={cn(
                                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                                    logCfg.bg,
                                    logCfg.color
                                  )}
                                >
                                  {idx + 1}
                                </div>
                                {idx < run.step_logs.length - 1 && (
                                  <div className="w-px h-4 bg-gray-200 mt-1" />
                                )}
                              </div>

                              {/* Step info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <StepIcon className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-800 capitalize">
                                    {actionLabel.replace(/_/g, " ")}
                                  </span>
                                  <LogIcon
                                    className={cn(
                                      "w-3.5 h-3.5 ml-auto",
                                      logCfg.color,
                                      log.status === "running" && "animate-spin"
                                    )}
                                  />
                                  <span className={cn("text-xs capitalize", logCfg.color)}>
                                    {log.status}
                                  </span>
                                </div>

                                {log.started_at && (
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {formatDuration(log.started_at, log.completed_at)}
                                  </div>
                                )}

                                {log.error_message && (
                                  <div className="text-xs text-red-600 mt-1 bg-red-50 p-1.5 rounded">
                                    {log.error_message}
                                  </div>
                                )}

                                {log.output_data && Object.keys(log.output_data).length > 0 && (
                                  <pre className="text-xs text-gray-500 mt-1 p-1.5 bg-gray-50 rounded overflow-x-auto font-mono">
                                    {JSON.stringify(log.output_data, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
