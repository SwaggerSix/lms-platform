"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Play,
  Settings,
  Clock,
  Eye,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";
import { WorkflowCanvas } from "@/components/workflows/workflow-canvas";
import { StepConfigPanel } from "@/components/workflows/step-config-panel";
import { AddStepMenu } from "@/components/workflows/add-step-menu";

export interface WorkflowData {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  version: number;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
}

export interface StepData {
  id: string;
  workflow_id: string;
  step_type: "condition" | "action" | "delay" | "branch" | "loop";
  step_config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  next_step_id: string | null;
  true_step_id: string | null;
  false_step_id: string | null;
  sequence_order: number;
}

export default function WorkflowEditorClient({
  workflow,
  initialSteps,
}: {
  workflow: WorkflowData;
  initialSteps: StepData[];
}) {
  const [steps, setSteps] = useState<StepData[]>(initialSteps);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [wfName, setWfName] = useState(workflow.name);
  const [wfDescription, setWfDescription] = useState(workflow.description || "");
  const [wfActive, setWfActive] = useState(workflow.is_active);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const toast = useToast();

  const selectedStep = steps.find((s) => s.id === selectedStepId) || null;

  const markChanged = useCallback(() => setHasChanges(true), []);

  async function addStep(stepType: StepData["step_type"], config: Record<string, unknown> = {}) {
    const maxOrder = steps.reduce((max, s) => Math.max(max, s.sequence_order), -1);
    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;

    // Position new step below the last one
    const posX = lastStep ? lastStep.position_x : 300;
    const posY = lastStep ? lastStep.position_y + 140 : 80;

    try {
      const res = await fetch(`/api/workflows/${workflow.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_type: stepType,
          step_config: config,
          position_x: posX,
          position_y: posY,
          sequence_order: maxOrder + 1,
        }),
      });
      if (!res.ok) throw new Error();
      const newStep = await res.json();

      // Auto-link previous step to new step
      const updated = [...steps];
      if (lastStep) {
        const idx = updated.findIndex((s) => s.id === lastStep.id);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], next_step_id: newStep.id };
        }
      }
      updated.push(newStep);
      setSteps(updated);
      setSelectedStepId(newStep.id);
      markChanged();
      toast.toast({ type: "success", message: "Step added" });
    } catch {
      toast.toast({ type: "error", message: "Failed to add step" });
    }
  }

  function updateStepLocal(stepId: string, updates: Partial<StepData>) {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    );
    markChanged();
  }

  function deleteStepLocal(stepId: string) {
    // Remove the step and update any references pointing to it
    setSteps((prev) => {
      const updated = prev
        .filter((s) => s.id !== stepId)
        .map((s) => ({
          ...s,
          next_step_id: s.next_step_id === stepId ? null : s.next_step_id,
          true_step_id: s.true_step_id === stepId ? null : s.true_step_id,
          false_step_id: s.false_step_id === stepId ? null : s.false_step_id,
        }));
      return updated;
    });
    if (selectedStepId === stepId) setSelectedStepId(null);
    markChanged();
  }

  async function saveAll() {
    setSaving(true);
    try {
      // Save workflow metadata
      const metaRes = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wfName,
          description: wfDescription || null,
          is_active: wfActive,
        }),
      });
      if (!metaRes.ok) throw new Error("Failed to save workflow");

      // Bulk save steps
      if (steps.length > 0) {
        const stepsRes = await fetch(`/api/workflows/${workflow.id}/steps`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            steps: steps.map((s) => ({
              id: s.id,
              step_type: s.step_type,
              step_config: s.step_config,
              position_x: s.position_x,
              position_y: s.position_y,
              next_step_id: s.next_step_id,
              true_step_id: s.true_step_id,
              false_step_id: s.false_step_id,
              sequence_order: s.sequence_order,
            })),
          }),
        });
        if (!stepsRes.ok) throw new Error("Failed to save steps");
      }

      setHasChanges(false);
      toast.toast({ type: "success", message: "Workflow saved" });
    } catch {
      toast.toast({ type: "error", message: "Failed to save workflow" });
    } finally {
      setSaving(false);
    }
  }

  async function runWorkflow() {
    setRunning(true);
    try {
      if (hasChanges) await saveAll();
      const res = await fetch(`/api/workflows/${workflow.id}/run`, { method: "POST" });
      if (!res.ok) throw new Error();
      const run = await res.json();
      toast.toast({
        type: run.status === "completed" ? "success" : "warning",
        message: `Run ${run.status}${run.error_message ? ": " + run.error_message : ""}`,
      });
    } catch {
      toast.toast({ type: "error", message: "Failed to run workflow" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/workflows"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{wfName}</h1>
            <p className="text-xs text-gray-500">
              {workflow.trigger_type} trigger &middot; v{workflow.version}
              {hasChanges && " \u00b7 unsaved changes"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
              showSettings
                ? "bg-gray-100 border-gray-300 text-gray-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <Link
            href={`/admin/workflows/${workflow.id}/runs`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Clock className="w-4 h-4" />
            History
          </Link>
          <button
            onClick={runWorkflow}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {running ? "Running..." : "Test Run"}
          </button>
          <button
            onClick={saveAll}
            disabled={saving || !hasChanges}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Settings panel (togglable) */}
        {showSettings && (
          <div className="w-72 border-r border-gray-200 bg-white p-4 overflow-y-auto flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Workflow Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={wfName}
                  onChange={(e) => { setWfName(e.target.value); markChanged(); }}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={wfDescription}
                  onChange={(e) => { setWfDescription(e.target.value); markChanged(); }}
                  rows={3}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Active</label>
                <button
                  onClick={() => { setWfActive(!wfActive); markChanged(); }}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    wfActive ? "bg-indigo-600" : "bg-gray-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                      wfActive && "translate-x-5"
                    )}
                  />
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trigger Type</label>
                <div className="px-2.5 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-600 capitalize">
                  {workflow.trigger_type}
                </div>
              </div>
              {workflow.trigger_type === "webhook" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Webhook URL</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      readOnly
                      value={`/api/workflows/webhook/${workflow.id}`}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/api/workflows/webhook/${workflow.id}`
                        );
                        toast.toast({ type: "success", message: "URL copied" });
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 relative bg-gray-50">
          <WorkflowCanvas
            steps={steps}
            selectedStepId={selectedStepId}
            onSelectStep={setSelectedStepId}
            onUpdateStep={updateStepLocal}
            onDeleteStep={deleteStepLocal}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <AddStepMenu onAdd={addStep} />
          </div>
        </div>

        {/* Config panel */}
        {selectedStep && (
          <StepConfigPanel
            step={selectedStep}
            allSteps={steps}
            onUpdate={(updates) => updateStepLocal(selectedStep.id, updates)}
            onDelete={() => deleteStepLocal(selectedStep.id)}
            onClose={() => setSelectedStepId(null)}
          />
        )}
      </div>
    </div>
  );
}
