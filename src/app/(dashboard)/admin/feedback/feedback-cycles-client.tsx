"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, EyeOff, ChevronRight, RefreshCw } from "lucide-react";

interface Cycle {
  id: string;
  name: string;
  description: string | null;
  status: string;
  cycle_type: string;
  start_date: string | null;
  end_date: string | null;
  anonymous: boolean;
  created_at: string;
  creator?: { id: string; first_name: string; last_name: string } | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400" },
  active: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  closed: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  archived: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-400" },
};

const TYPE_LABELS: Record<string, string> = {
  "360": "360-Degree",
  peer: "Peer Review",
  manager: "Manager Review",
  self: "Self Assessment",
};

export default function FeedbackCyclesClient({ cycles: initialCycles }: { cycles: Cycle[] }) {
  const router = useRouter();
  const [cycles, setCycles] = useState(initialCycles);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cycle_type: "360",
    anonymous: true,
    start_date: "",
    end_date: "",
  });

  const filteredCycles = filterStatus === "all"
    ? cycles
    : cycles.filter((c) => c.status === filterStatus);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/feedback/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }),
      });
      if (res.ok) {
        const newCycle = await res.json();
        setCycles([newCycle, ...cycles]);
        setShowCreate(false);
        setFormData({ name: "", description: "", cycle_type: "360", anonymous: true, start_date: "", end_date: "" });
        router.push(`/admin/feedback/${newCycle.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">360-Degree Feedback</h1>
          <p className="text-gray-500 mt-1">Manage feedback cycles, nominate reviewers, and view reports</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Cycle
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Feedback Cycle</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cycle Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Q1 2026 Performance Review"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.cycle_type}
                onChange={(e) => setFormData({ ...formData, cycle_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              >
                <option value="360">360-Degree</option>
                <option value="peer">Peer Review</option>
                <option value="manager">Manager Review</option>
                <option value="self">Self Assessment</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Describe the purpose and scope of this feedback cycle..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.anonymous}
                onChange={(e) => setFormData({ ...formData, anonymous: e.target.checked })}
                id="anonymous"
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label htmlFor="anonymous" className="text-sm text-gray-700">Anonymous feedback</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formData.name}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Cycle"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "draft", "active", "closed", "archived"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
              filterStatus === status
                ? "bg-primary-100 text-primary-700 font-medium"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {status}
            {status !== "all" && (
              <span className="ml-1 text-xs">
                ({cycles.filter((c) => c.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cycles List */}
      <div className="grid gap-4">
        {filteredCycles.map((cycle) => {
          const style = STATUS_STYLES[cycle.status] || STATUS_STYLES.draft;
          return (
            <Link
              key={cycle.id}
              href={`/admin/feedback/${cycle.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {cycle.name}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      {cycle.status}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {TYPE_LABELS[cycle.cycle_type] || cycle.cycle_type}
                    </span>
                  </div>
                  {cycle.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cycle.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    {cycle.creator && (
                      <span>Created by {cycle.creator.first_name} {cycle.creator.last_name}</span>
                    )}
                    <span>{new Date(cycle.created_at).toLocaleDateString()}</span>
                    {cycle.start_date && cycle.end_date && (
                      <span>
                        {new Date(cycle.start_date).toLocaleDateString()} - {new Date(cycle.end_date).toLocaleDateString()}
                      </span>
                    )}
                    {cycle.anonymous && (
                      <span className="flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        Anonymous
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </Link>
          );
        })}

        {filteredCycles.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <RefreshCw className="w-16 h-16 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-medium text-gray-900">No feedback cycles</h3>
            <p className="text-gray-500 mt-1">Create your first feedback cycle to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
