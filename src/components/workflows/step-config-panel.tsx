"use client";

import { useState } from "react";
import {
  X,
  Trash2,
  GitBranch,
  Zap,
  Timer,
  Repeat,
  Filter,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { ConditionBuilder } from "./condition-builder";

interface Step {
  id: string;
  step_type: "condition" | "action" | "delay" | "branch" | "loop";
  step_config: Record<string, unknown>;
  next_step_id: string | null;
  true_step_id: string | null;
  false_step_id: string | null;
}

interface StepConfigPanelProps {
  step: Step;
  allSteps: Step[];
  onUpdate: (updates: Partial<Step>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const ACTION_TYPES = [
  { value: "send_email", label: "Send Email" },
  { value: "send_notification", label: "Send Notification" },
  { value: "enroll_user", label: "Enroll User" },
  { value: "unenroll_user", label: "Unenroll User" },
  { value: "assign_badge", label: "Assign Badge" },
  { value: "update_user_field", label: "Update User Field" },
  { value: "create_task", label: "Create Task" },
  { value: "webhook_call", label: "Webhook Call" },
];

const stepTypeIcons: Record<string, typeof Zap> = {
  condition: Filter,
  action: Zap,
  delay: Timer,
  branch: GitBranch,
  loop: Repeat,
};

export function StepConfigPanel({
  step,
  allSteps,
  onUpdate,
  onDelete,
  onClose,
}: StepConfigPanelProps) {
  const Icon = stepTypeIcons[step.step_type] || Zap;
  const config = step.step_config;
  const otherSteps = allSteps.filter((s) => s.id !== step.id);

  function updateConfig(key: string, value: unknown) {
    onUpdate({ step_config: { ...config, [key]: value } });
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900 capitalize">
            {step.step_type} Configuration
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Action config */}
        {step.step_type === "action" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Action Type
              </label>
              <select
                value={(config.action_type as string) || ""}
                onChange={(e) => updateConfig("action_type", e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Select action...</option>
                {ACTION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            {/* Action-specific fields */}
            {config.action_type === "send_email" && (
              <>
                <Field label="To" value={config.to} onChange={(v) => updateConfig("to", v)} placeholder="{{user.email}}" />
                <Field label="Subject" value={config.subject} onChange={(v) => updateConfig("subject", v)} placeholder="Welcome!" />
                <TextArea label="Body" value={config.body} onChange={(v) => updateConfig("body", v)} placeholder="Email body..." />
              </>
            )}

            {config.action_type === "send_notification" && (
              <>
                <Field label="User ID" value={config.user_id} onChange={(v) => updateConfig("user_id", v)} placeholder="{{user.id}}" />
                <Field label="Title" value={config.title} onChange={(v) => updateConfig("title", v)} placeholder="Notification title" />
                <TextArea label="Body" value={config.body} onChange={(v) => updateConfig("body", v)} placeholder="Notification body..." />
              </>
            )}

            {config.action_type === "enroll_user" && (
              <>
                <Field label="User ID" value={config.user_id} onChange={(v) => updateConfig("user_id", v)} placeholder="{{user.id}}" />
                <Field label="Course ID" value={config.course_id} onChange={(v) => updateConfig("course_id", v)} placeholder="Course UUID" />
              </>
            )}

            {config.action_type === "unenroll_user" && (
              <>
                <Field label="User ID" value={config.user_id} onChange={(v) => updateConfig("user_id", v)} placeholder="{{user.id}}" />
                <Field label="Course ID" value={config.course_id} onChange={(v) => updateConfig("course_id", v)} placeholder="Course UUID" />
              </>
            )}

            {config.action_type === "assign_badge" && (
              <>
                <Field label="User ID" value={config.user_id} onChange={(v) => updateConfig("user_id", v)} placeholder="{{user.id}}" />
                <Field label="Badge ID" value={config.badge_id} onChange={(v) => updateConfig("badge_id", v)} placeholder="Badge UUID" />
              </>
            )}

            {config.action_type === "update_user_field" && (
              <>
                <Field label="User ID" value={config.user_id} onChange={(v) => updateConfig("user_id", v)} placeholder="{{user.id}}" />
                <Field label="Field" value={config.field} onChange={(v) => updateConfig("field", v)} placeholder="e.g. job_title" />
                <Field label="Value" value={config.value} onChange={(v) => updateConfig("value", v)} placeholder="New value" />
              </>
            )}

            {config.action_type === "create_task" && (
              <>
                <Field label="Title" value={config.title} onChange={(v) => updateConfig("title", v)} placeholder="Task title" />
                <Field label="Assignee ID" value={config.assignee_id} onChange={(v) => updateConfig("assignee_id", v)} placeholder="{{user.id}}" />
              </>
            )}

            {config.action_type === "webhook_call" && (
              <>
                <Field label="URL" value={config.url} onChange={(v) => updateConfig("url", v)} placeholder="https://..." />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                  <select
                    value={(config.method as string) || "POST"}
                    onChange={(e) => updateConfig("method", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
              </>
            )}
          </>
        )}

        {/* Delay config */}
        {step.step_type === "delay" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Delay Duration
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={Number(config.duration_value || 0)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateConfig("duration_value", val);
                    const unit = (config.duration_unit as string) || "seconds";
                    const multiplier = unit === "minutes" ? 60 : unit === "hours" ? 3600 : unit === "days" ? 86400 : 1;
                    updateConfig("duration_seconds", val * multiplier);
                  }}
                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <select
                  value={(config.duration_unit as string) || "seconds"}
                  onChange={(e) => {
                    updateConfig("duration_unit", e.target.value);
                    const val = Number(config.duration_value || 0);
                    const multiplier = e.target.value === "minutes" ? 60 : e.target.value === "hours" ? 3600 : e.target.value === "days" ? 86400 : 1;
                    updateConfig("duration_seconds", val * multiplier);
                  }}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Condition / Branch config */}
        {(step.step_type === "condition" || step.step_type === "branch") && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Condition Rules
            </label>
            <ConditionBuilder
              condition={config.condition as Record<string, unknown> | undefined}
              onChange={(condition) => updateConfig("condition", condition)}
            />
          </div>
        )}

        {/* Loop config */}
        {step.step_type === "loop" && (
          <Field
            label="Items Field"
            value={config.items_field}
            onChange={(v) => updateConfig("items_field", v)}
            placeholder="e.g. users, enrollments"
          />
        )}

        {/* Connection selectors */}
        <hr className="my-2" />
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Connections
        </h4>

        {step.step_type !== "condition" && step.step_type !== "branch" && (
          <ConnectionSelect
            label="Next Step"
            value={step.next_step_id}
            options={otherSteps}
            onChange={(v) => onUpdate({ next_step_id: v })}
          />
        )}

        {(step.step_type === "condition" || step.step_type === "branch") && (
          <>
            <ConnectionSelect
              label="If True (Yes)"
              value={step.true_step_id}
              options={otherSteps}
              onChange={(v) => onUpdate({ true_step_id: v })}
              color="text-green-600"
            />
            <ConnectionSelect
              label="If False (No)"
              value={step.false_step_id}
              options={otherSteps}
              onChange={(v) => onUpdate({ false_step_id: v })}
              color="text-red-600"
            />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={onDelete}
          className="flex items-center gap-2 w-full justify-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Step
        </button>
      </div>
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={String(value || "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <textarea
        value={String(value || "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
      />
    </div>
  );
}

function ConnectionSelect({
  label,
  value,
  options,
  onChange,
  color,
}: {
  label: string;
  value: string | null;
  options: Step[];
  onChange: (v: string | null) => void;
  color?: string;
}) {
  return (
    <div>
      <label className={cn("block text-xs font-medium mb-1", color || "text-gray-600")}>
        {label}
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
      >
        <option value="">None (end)</option>
        {options.map((s) => {
          const stepLabel =
            s.step_type === "action"
              ? (s.step_config.action_type as string || "action").replace(/_/g, " ")
              : s.step_type;
          return (
            <option key={s.id} value={s.id}>
              {stepLabel} ({s.id.slice(0, 6)})
            </option>
          );
        })}
      </select>
    </div>
  );
}
