"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import EmbedCodeGenerator from "@/components/microlearning/embed-code-generator";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

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

  const nuggetColumns: DataTableColumn<Nugget>[] = [
    {
      key: "title",
      header: "Title",
      sortValue: (n) => n.title,
      render: (nugget) => (
        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{nugget.title}</p>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortValue: (n) => n.content_type,
      render: (nugget) => (
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {typeLabels[nugget.content_type] || nugget.content_type}
        </span>
      ),
    },
    {
      key: "difficulty",
      header: "Difficulty",
      sortValue: (n) => n.difficulty ?? null,
      render: (nugget) => (
        <span className="text-xs text-gray-600 capitalize">{nugget.difficulty || "-"}</span>
      ),
    },
    {
      key: "views",
      header: "Views",
      sortValue: (n) => n.view_count,
      render: (nugget) => <span className="text-sm text-gray-700">{nugget.view_count}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (n) => (n.is_active ? "Active" : "Inactive"),
      render: (nugget) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${nugget.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {nugget.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      render: (nugget) => (
        <button
          onClick={() => handleDeleteNugget(nugget.id)}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Delete
          <span className="sr-only">, {nugget.title}</span>
        </button>
      ),
    },
  ];

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
          { label: "Total Nuggets", value: stats.totalNuggets, color: "bg-primary-100 text-primary-600" },
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
      <SegmentedControl
        aria-label="Microlearning views"
        className="mb-6"
        value={activeTab}
        onChange={(v) => setActiveTab(v as typeof activeTab)}
        options={[
          { value: "nuggets", label: "Nuggets" },
          { value: "widgets", label: "Embed Widgets" },
        ]}
      />

      {/* Nuggets Tab */}
      {activeTab === "nuggets" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Learning Nuggets</h2>
            <Button onClick={() => setShowCreateNugget(true)}>
              Create Nugget
            </Button>
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter nugget title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                    <select
                      value={nuggetForm.content_type}
                      onChange={(e) => setNuggetForm((p) => ({ ...p, content_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="javascript, react, frontend"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Duration (seconds)</label>
                  <input
                    type="number"
                    value={nuggetForm.estimated_seconds}
                    onChange={(e) => setNuggetForm((p) => ({ ...p, estimated_seconds: parseInt(e.target.value) || 60 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowCreateNugget(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateNugget}
                  disabled={creating || !nuggetForm.title}
                >
                  {creating ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          )}

          {/* Nuggets Table */}
          <DataTable
            columns={nuggetColumns}
            rows={nuggets}
            rowKey={(nugget) => nugget.id}
            ariaLabel="Learning nuggets"
            emptyState={{
              icon: <Lightbulb className="h-10 w-10" aria-hidden="true" />,
              title: "No nuggets yet",
              description: "Create your first one above.",
            }}
          />
        </div>
      )}

      {/* Widgets Tab */}
      {activeTab === "widgets" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Embed Widgets</h2>
            <Button onClick={() => setShowCreateWidget(true)}>
              Create Widget
            </Button>
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="My Learning Widget"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Widget Type</label>
                  <select
                    value={widgetForm.widget_type}
                    onChange={(e) => setWidgetForm((p) => ({ ...p, widget_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="example.com, mysite.org"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowCreateWidget(false)}>Cancel</Button>
                <Button
                  onClick={handleCreateWidget}
                  disabled={creating || !widgetForm.name}
                >
                  {creating ? "Creating..." : "Create Widget"}
                </Button>
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
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium whitespace-nowrap"
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
