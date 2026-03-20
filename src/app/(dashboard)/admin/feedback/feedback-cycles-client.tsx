"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.cycle_type}
                onChange={(e) => setFormData({ ...formData, cycle_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.anonymous}
                onChange={(e) => setFormData({ ...formData, anonymous: e.target.checked })}
                id="anonymous"
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
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
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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
                ? "bg-indigo-100 text-indigo-700 font-medium"
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
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
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
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        Anonymous
                      </span>
                    )}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}

        {filteredCycles.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">No feedback cycles</h3>
            <p className="text-gray-500 mt-1">Create your first feedback cycle to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
