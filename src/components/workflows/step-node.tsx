"use client";

import {
  GitBranch,
  Zap,
  Timer,
  Repeat,
  Filter,
  Mail,
  Bell,
  UserPlus,
  UserMinus,
  Award,
  Edit3,
  ListTodo,
  Globe,
  Clock,
} from "lucide-react";
import { cn } from "@/utils/cn";

interface StepNodeProps {
  step: {
    id: string;
    step_type: "condition" | "action" | "delay" | "branch" | "loop";
    step_config: Record<string, unknown>;
  };
  isSelected: boolean;
  onClick: () => void;
}

const stepTypeConfig: Record<
  string,
  { icon: typeof Zap; label: string; color: string; bg: string; border: string }
> = {
  condition: {
    icon: Filter,
    label: "Condition",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  action: {
    icon: Zap,
    label: "Action",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
  delay: {
    icon: Timer,
    label: "Delay",
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
  branch: {
    icon: GitBranch,
    label: "Branch",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  loop: {
    icon: Repeat,
    label: "Loop",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
};

const actionIcons: Record<string, typeof Zap> = {
  send_email: Mail,
  send_notification: Bell,
  enroll_user: UserPlus,
  unenroll_user: UserMinus,
  assign_badge: Award,
  update_user_field: Edit3,
  create_task: ListTodo,
  webhook_call: Globe,
  delay: Clock,
};

function getStepLabel(step: StepNodeProps["step"]): string {
  const config = step.step_config;

  if (step.step_type === "action") {
    const actionType = (config.action_type as string) || "";
    return actionType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Action";
  }

  if (step.step_type === "condition" || step.step_type === "branch") {
    const cond = config.condition as Record<string, unknown> | undefined;
    if (cond?.field) return `If ${cond.field}`;
    return step.step_type === "branch" ? "Branch" : "Condition";
  }

  if (step.step_type === "delay") {
    const seconds = config.duration_seconds as number;
    if (seconds) {
      if (seconds >= 86400) return `Wait ${Math.floor(seconds / 86400)}d`;
      if (seconds >= 3600) return `Wait ${Math.floor(seconds / 3600)}h`;
      if (seconds >= 60) return `Wait ${Math.floor(seconds / 60)}m`;
      return `Wait ${seconds}s`;
    }
    return "Delay";
  }

  if (step.step_type === "loop") {
    return config.items_field ? `Loop: ${config.items_field}` : "Loop";
  }

  return stepTypeConfig[step.step_type]?.label || "Step";
}

function getStepIcon(step: StepNodeProps["step"]) {
  if (step.step_type === "action") {
    const actionType = step.step_config.action_type as string;
    return actionIcons[actionType] || Zap;
  }
  return stepTypeConfig[step.step_type]?.icon || Zap;
}

export function StepNode({ step, isSelected, onClick }: StepNodeProps) {
  const typeConfig = stepTypeConfig[step.step_type] || stepTypeConfig.action;
  const Icon = getStepIcon(step);
  const label = getStepLabel(step);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 bg-white shadow-sm transition-all text-left",
        "hover:shadow-md",
        isSelected
          ? "border-indigo-500 shadow-md ring-2 ring-indigo-100"
          : `${typeConfig.border} hover:border-gray-300`
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
          typeConfig.bg
        )}
      >
        <Icon className={cn("w-4.5 h-4.5", typeConfig.color)} />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {typeConfig.label}
        </div>
        <div className="text-sm font-semibold text-gray-800 truncate">{label}</div>
      </div>

      {/* Connection dots */}
      <div className="flex flex-col gap-1">
        {(step.step_type === "condition" || step.step_type === "branch") && (
          <>
            <div className="w-2 h-2 rounded-full bg-green-400" title="True path" />
            <div className="w-2 h-2 rounded-full bg-red-400" title="False path" />
          </>
        )}
      </div>
    </button>
  );
}
