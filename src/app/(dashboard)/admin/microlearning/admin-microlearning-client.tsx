"use client";

import { useState } from "react";
import EmbedCodeGenerator from "@/components/microlearning/embed-code-generator";

interface Nugget {
  id: string;
  title: string;
  content_type: string;
  difficulty?: string;
  is_active: boolean;
  view_count: number;
  created_at: string;
}

interface Widget {
  id: string;
  name: string;
  widget_type: string;
  embed_token: string;
  is_active: boolean;
  created_at: string;
}

interface Props {
  initialNuggets: Nugget[];
  initialWidgets: Widget[];
  stats: {
    totalNuggets: number;
    totalViews: number;
    totalCompletions: number;
    totalWidgets: number;
  };
}

const typeLabels: Record<string, string> = {
  tip: "Tip",
  flashcard: "Flashcard",
  quiz: "Quiz",
  video_clip: "Video Clip",
  infographic: "Infographic",
  checklist: "Checklist",
};

export default function AdminMicrolearningClient({ initialNuggets, initialWidgets, stats }: Props) {
  const [activeTab, setActiveTab] = useState<"nuggets" | "widgets">("nuggets");
  const [nuggets, setNuggets] = useState<Nugget[]>(initialNuggets);
  const [widgets, setWidgets] = useState<Widget[]>(initialWidgets);
  const [showCreateNugget, setShowCreateNugget] = useState(false);
  const [showCreateWidget, setShowCreateWidget] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);

  // Nugget form state
  const [nuggetForm, setNuggetForm] = useState({
    title: "",
    content_type: "tip",
    difficulty: "beginner",
    content: "{}",
    tags: "",
    estimated_seconds: 60,
  });
  const [creating, setCreating] = useState(false);

  // Widget form state
  const [widgetForm, setWidgetForm] = useState({
    name: "",
    widget_type: "nugget_feed",
    allowed_domains: "",
  });

  const handleCreateNugget = async () => {
    setCreating(true);
    try {
      let content: Record<string, unknown>;
      try {
        content = JSON.parse(nuggetForm.content);
      } catch {
        alert("Invalid JSON in content field");
        setCreating(false);
        return;
      }

      const res = await fetch("/api/microlearning/nuggets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nuggetForm.title,
          content_type: nuggetForm.content_type,
          difficulty: nuggetForm.difficulty,
          content,
          tags: nuggetForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
          estimated_seconds: nuggetForm.estimated_seconds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create nugget");
        return;
      }

      const data = await res.json();
      setNuggets((prev) => [data, ...prev]);
      setShowCreateNugget(false);
      setNuggetForm({ title: "", content_type: "tip", difficulty: "beginner", content: "{}", tags: "", estimated_seconds: 60 });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateWidget = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/embed/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: widgetForm.name,
          widget_type: widgetForm.widget_type,
          allowed_domains: widgetForm.allowed_domains.split(",").map((d) => d.trim()).filter(Boolean),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create widget");
        return;
      }

      const data = await res.json();
      setWidgets((prev) => [data, ...prev]);
      setShowCreateWidget(false);
      setWidgetForm({ name: "", widget_type: "nugget_feed", allowed_domains: "" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNugget = async (id: string) => {
    if (!confirm("Delete this nugget?")) return;
    const res = await fetch(`/api/microlearning/nuggets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNuggets((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Microlearning Management</h1>
        <p className="text-gray-500 mt-1">Create nuggets, manage widgets, and view analytics</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Nuggets", value: stats.totalNuggets, color: "bg-indigo-100 text-indigo-600" },
          { label: "Total Views", value: stats.totalViews.toLocaleString(), color: "bg-blue-100 text-blue-600" },
          { label: "Completions", value: stats.totalCompletions, color: "bg-green-100 text-green-600" },
          { label: "Embed Widgets", value: stats.totalWidgets, color: "bg-amber-100 text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab("nuggets")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "nuggets" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Nuggets
        </button>
        <button
          onClick={() => setActiveTab("widgets")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "widgets" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Embed Widgets
        </button>
      </div>

      {/* Nuggets Tab */}
      {activeTab === "nuggets" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Learning Nuggets</h2>
            <button
              onClick={() => setShowCreateNugget(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Create Nugget
            </button>
          </div>

          {/* Create Nugget Form */}
          {showCreateNugget && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Title</label>
                  <input
                    type="text"
                    value={nuggetForm.title}
                    onChange={(e) => setNuggetForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter nugget title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                    <select
                      value={nuggetForm.content_type}
                      onChange={(e) => setNuggetForm((p) => ({ ...p, content_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {Object.entries(typeLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Difficulty</label>
                    <select
                      value={nuggetForm.difficulty}
                      onChange={(e) => setNuggetForm((p) => ({ ...p, difficulty: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Content (JSON)</label>
                <textarea
                  value={nuggetForm.content}
                  onChange={(e) => setNuggetForm((p) => ({ ...p, content: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={4}
                  placeholder='{"text": "Your tip content here..."}'
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={nuggetForm.tags}
                    onChange={(e) => setNuggetForm((p) => ({ ...p, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="javascript, react, frontend"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Duration (seconds)</label>
                  <input
                    type="number"
                    value={nuggetForm.estimated_seconds}
                    onChange={(e) => setNuggetForm((p) => ({ ...p, estimated_seconds: parseInt(e.target.value) || 60 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateNugget(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNugget}
                  disabled={creating || !nuggetForm.title}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          )}

          {/* Nuggets Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Title</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Difficulty</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Views</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {nuggets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500 text-sm">
                      No nuggets yet. Create your first one above.
                    </td>
                  </tr>
                ) : (
                  nuggets.map((nugget) => (
                    <tr key={nugget.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{nugget.title}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {typeLabels[nugget.content_type] || nugget.content_type}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-600 capitalize">{nugget.difficulty || "-"}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-gray-700">{nugget.view_count}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${nugget.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {nugget.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteNugget(nugget.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Widgets Tab */}
      {activeTab === "widgets" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Embed Widgets</h2>
            <button
              onClick={() => setShowCreateWidget(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Create Widget
            </button>
          </div>

          {/* Create Widget Form */}
          {showCreateWidget && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Widget Name</label>
                  <input
                    type="text"
                    value={widgetForm.name}
                    onChange={(e) => setWidgetForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="My Learning Widget"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Widget Type</label>
                  <select
                    value={widgetForm.widget_type}
                    onChange={(e) => setWidgetForm((p) => ({ ...p, widget_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="nugget_feed">Nugget Feed</option>
                    <option value="course_card">Course Card</option>
                    <option value="progress_bar">Progress Bar</option>
                    <option value="leaderboard">Leaderboard</option>
                    <option value="skill_radar">Skill Radar</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Allowed Domains (comma-separated, leave empty for all)</label>
                <input
                  type="text"
                  value={widgetForm.allowed_domains}
                  onChange={(e) => setWidgetForm((p) => ({ ...p, allowed_domains: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="example.com, mysite.org"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreateWidget(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button
                  onClick={handleCreateWidget}
                  disabled={creating || !widgetForm.name}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating..." : "Create Widget"}
                </button>
              </div>
            </div>
          )}

          {/* Widgets List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {widgets.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-500 text-sm">No embed widgets yet. Create one above.</p>
              </div>
            ) : (
              widgets.map((widget) => (
                <div key={widget.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{widget.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{widget.widget_type.replace("_", " ")}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${widget.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {widget.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 truncate flex-1">
                      {widget.embed_token}
                    </code>
                    <button
                      onClick={() => setSelectedWidget(selectedWidget?.id === widget.id ? null : widget)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
                    >
                      {selectedWidget?.id === widget.id ? "Hide Code" : "Get Code"}
                    </button>
                  </div>
                  {selectedWidget?.id === widget.id && (
                    <div className="mt-4">
                      <EmbedCodeGenerator widget={widget} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
