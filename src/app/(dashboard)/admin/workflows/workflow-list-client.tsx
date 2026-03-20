"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Workflow,
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  Zap,
  Globe,
  Calendar,
  MousePointerClick,
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";

interface WorkflowItem {
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
  updated_at: string;
}

const triggerIcons: Record<string, typeof Zap> = {
  event: Zap,
  schedule: Calendar,
  webhook: Globe,
  manual: MousePointerClick,
};

const triggerLabels: Record<string, string> = {
  event: "Event",
  schedule: "Schedule",
  webhook: "Webhook",
  manual: "Manual",
};

export default function WorkflowListClient({
  initialWorkflows,
}: {
  initialWorkflows: WorkflowItem[];
}) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [search, setSearch] = useState("");
  const [filterTrigger, setFilterTrigger] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTrigger, setNewTrigger] = useState<string>("manual");
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const toast = useToast();

  const filtered = workflows.filter((w) => {
    const matchesSearch =
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesTrigger = !filterTrigger || w.trigger_type === filterTrigger;
    return matchesSearch && matchesTrigger;
  });

  async function createWorkflow() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || null,
          trigger_type: newTrigger,
        }),
      });
      if (!res.ok) throw new Error("Failed to create workflow");
      const data = await res.json();
      setWorkflows([data, ...workflows]);
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewTrigger("manual");
      toast.toast({ type: "success", message: "Workflow created" });
    } catch {
      toast.toast({ type: "error", message: "Failed to create workflow" });
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!res.ok) throw new Error();
      setWorkflows(workflows.map((w) => (w.id === id ? { ...w, is_active: !isActive } : w)));
      toast.toast({ type: "success", message: `Workflow ${isActive ? "paused" : "activated"}` });
    } catch {
      toast.toast({ type: "error", message: "Failed to update workflow" });
    }
    setMenuOpen(null);
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setWorkflows(workflows.filter((w) => w.id !== id));
      toast.toast({ type: "success", message: "Workflow deleted" });
    } catch {
      toast.toast({ type: "error", message: "Failed to delete workflow" });
    }
    setMenuOpen(null);
  }

  async function runWorkflow(id: string) {
    try {
      const res = await fetch(`/api/workflows/${id}/run`, { method: "POST" });
      if (!res.ok) throw new Error();
      const run = await res.json();
      toast.toast({
        type: run.status === "completed" ? "success" : "warning",
        message: `Workflow run ${run.status}`,
      });
      // Update last_run_at and run_count
      setWorkflows(
        workflows.map((w) =>
          w.id === id
            ? { ...w, last_run_at: new Date().toISOString(), run_count: w.run_count + 1 }
            : w
        )
      );
    } catch {
      toast.toast({ type: "error", message: "Failed to run workflow" });
    }
    setMenuOpen(null);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Workflow className="w-7 h-7 text-indigo-600" />
            Workflow Automation
          </h1>
          <p className="text-gray-500 mt-1">Build visual automation workflows with triggers, conditions, and actions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={filterTrigger}
          onChange={(e) => setFilterTrigger(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">All Triggers</option>
          <option value="event">Event</option>
          <option value="schedule">Schedule</option>
          <option value="webhook">Webhook</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Workflows", value: workflows.length, color: "bg-indigo-50 text-indigo-700" },
          { label: "Active", value: workflows.filter((w) => w.is_active).length, color: "bg-green-50 text-green-700" },
          { label: "Paused", value: workflows.filter((w) => !w.is_active).length, color: "bg-yellow-50 text-yellow-700" },
          { label: "Total Runs", value: workflows.reduce((s, w) => s + w.run_count, 0), color: "bg-blue-50 text-blue-700" },
        ].map((stat) => (
          <div key={stat.label} className={cn("rounded-lg p-4", stat.color)}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Workflow List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Workflow className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No workflows found</p>
            <p className="text-sm mt-1">Create your first workflow to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((workflow) => {
              const TriggerIcon = triggerIcons[workflow.trigger_type] || Zap;
              return (
                <div
                  key={workflow.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group"
                >
                  {/* Status indicator */}
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                      workflow.is_active ? "bg-green-500" : "bg-gray-300"
                    )}
                  />

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <TriggerIcon className="w-5 h-5 text-indigo-600" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/workflows/${workflow.id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {workflow.name}
                    </Link>
                    {workflow.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{workflow.description}</p>
                    )}
                  </div>

                  {/* Trigger badge */}
                  <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                    {triggerLabels[workflow.trigger_type] || workflow.trigger_type}
                  </span>

                  {/* Run count */}
                  <div className="text-xs text-gray-500 w-20 text-right">
                    <div className="font-medium">{workflow.run_count} runs</div>
                    {workflow.last_run_at && (
                      <div className="text-gray-400">
                        {new Date(workflow.last_run_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full",
                      workflow.is_active
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {workflow.is_active ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {workflow.is_active ? "Active" : "Paused"}
                  </span>

                  {/* Actions */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === workflow.id ? null : workflow.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                    {menuOpen === workflow.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <button
                          onClick={() => runWorkflow(workflow.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Play className="w-4 h-4" /> Run Now
                        </button>
                        <button
                          onClick={() => toggleActive(workflow.id, workflow.is_active)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {workflow.is_active ? (
                            <>
                              <Pause className="w-4 h-4" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" /> Activate
                            </>
                          )}
                        </button>
                        <Link
                          href={`/admin/workflows/${workflow.id}/runs`}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Clock className="w-4 h-4" /> Run History
                        </Link>
                        <hr className="my-1" />
                        <button
                          onClick={() => deleteWorkflow(workflow.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/admin/workflows/${workflow.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Workflow</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. New Employee Onboarding"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  placeholder="What does this workflow do?"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["event", "schedule", "webhook", "manual"] as const).map((t) => {
                    const Icon = triggerIcons[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setNewTrigger(t)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors",
                          newTrigger === t
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {triggerLabels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={createWorkflow}
                disabled={!newName.trim() || creating}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create Workflow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
