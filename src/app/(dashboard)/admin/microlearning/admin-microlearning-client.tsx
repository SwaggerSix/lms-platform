"use client";

import { useState } from "react";
import { Lightbulb, Plus, Trash2 } from "lucide-react";
import EmbedCodeGenerator from "@/components/microlearning/embed-code-generator";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

interface Nugget {
  id: string;
  title: string;
  content_type: string;
  difficulty?: string;
  content?: Record<string, unknown> | null;
  tags?: string[] | null;
  estimated_seconds?: number | null;
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

// Structured content draft covering every nugget type's fields. buildNuggetContent
// serializes only the fields the chosen type uses, matching exactly what the
// learner nugget renderer reads (see components/microlearning/nugget-card.tsx).
type ContentDraft = {
  text: string;
  source: string;
  front: string;
  back: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  url: string;
  image_url: string;
  caption: string;
  items: string[];
};

function emptyContentDraft(): ContentDraft {
  return {
    text: "", source: "",
    front: "", back: "",
    question: "", options: ["", ""], correct_answer: 0, explanation: "",
    url: "", image_url: "", caption: "",
    items: [""],
  };
}

function buildNuggetContent(
  type: string,
  d: ContentDraft
): { content: Record<string, unknown>; error?: string } {
  switch (type) {
    case "tip":
      if (!d.text.trim()) return { content: {}, error: "Add the tip text." };
      return { content: { text: d.text.trim(), ...(d.source.trim() ? { source: d.source.trim() } : {}) } };
    case "flashcard":
      if (!d.front.trim() || !d.back.trim()) return { content: {}, error: "A flashcard needs both a front and a back." };
      return { content: { front: d.front.trim(), back: d.back.trim() } };
    case "quiz": {
      const options = d.options.map((o) => o.trim()).filter(Boolean);
      if (!d.question.trim()) return { content: {}, error: "Add the quiz question." };
      if (options.length < 2) return { content: {}, error: "A quiz needs at least two options." };
      const correct_answer = Math.min(Math.max(0, d.correct_answer), options.length - 1);
      return { content: { question: d.question.trim(), options, correct_answer, ...(d.explanation.trim() ? { explanation: d.explanation.trim() } : {}) } };
    }
    case "video_clip":
      if (!d.url.trim()) return { content: {}, error: "Add the video URL." };
      return { content: { url: d.url.trim(), ...(d.caption.trim() ? { caption: d.caption.trim() } : {}) } };
    case "infographic":
      if (!d.image_url.trim()) return { content: {}, error: "Add the image URL." };
      return { content: { image_url: d.image_url.trim(), ...(d.caption.trim() ? { caption: d.caption.trim() } : {}) } };
    case "checklist": {
      const items = d.items.map((i) => i.trim()).filter(Boolean);
      if (items.length < 1) return { content: {}, error: "Add at least one checklist item." };
      return { content: { items } };
    }
    default:
      return { content: {} };
  }
}

/** Map a stored nugget's content back into an editable draft so an existing
 * nugget can be re-opened in the structured editor. Unused fields keep their
 * empty defaults. */
function draftFromContent(type: string, content: Record<string, unknown> | null | undefined): ContentDraft {
  const d = emptyContentDraft();
  const c = (content ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  switch (type) {
    case "tip":
      d.text = str(c.text); d.source = str(c.source); break;
    case "flashcard":
      d.front = str(c.front); d.back = str(c.back); break;
    case "quiz":
      d.question = str(c.question);
      d.options = Array.isArray(c.options) && c.options.length >= 2 ? c.options.map(str) : ["", ""];
      d.correct_answer = typeof c.correct_answer === "number" ? c.correct_answer : 0;
      d.explanation = str(c.explanation);
      break;
    case "video_clip":
      d.url = str(c.url); d.caption = str(c.caption); break;
    case "infographic":
      d.image_url = str(c.image_url); d.caption = str(c.caption); break;
    case "checklist":
      d.items = Array.isArray(c.items) && c.items.length ? c.items.map(str) : [""]; break;
  }
  return d;
}

export default function AdminMicrolearningClient({ initialNuggets, initialWidgets, stats }: Props) {
  const [activeTab, setActiveTab] = useState<"nuggets" | "widgets">("nuggets");
  const [nuggets, setNuggets] = useState<Nugget[]>(initialNuggets);
  const [widgets, setWidgets] = useState<Widget[]>(initialWidgets);
  const [showCreateNugget, setShowCreateNugget] = useState(false);
  const [editingNuggetId, setEditingNuggetId] = useState<string | null>(null);
  const [showCreateWidget, setShowCreateWidget] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);

  // Nugget form state
  const [nuggetForm, setNuggetForm] = useState({
    title: "",
    content_type: "tip",
    difficulty: "beginner",
    tags: "",
    estimated_seconds: 60,
  });
  const [contentDraft, setContentDraft] = useState<ContentDraft>(emptyContentDraft());
  const [nuggetError, setNuggetError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const setDraft = (patch: Partial<ContentDraft>) => setContentDraft((p) => ({ ...p, ...patch }));
  const setQuizOption = (idx: number, value: string) =>
    setContentDraft((p) => ({ ...p, options: p.options.map((o, i) => (i === idx ? value : o)) }));
  const setChecklistItem = (idx: number, value: string) =>
    setContentDraft((p) => ({ ...p, items: p.items.map((o, i) => (i === idx ? value : o)) }));

  // Widget form state
  const [widgetForm, setWidgetForm] = useState({
    name: "",
    widget_type: "nugget_feed",
    allowed_domains: "",
  });

  const openCreateNugget = () => {
    setEditingNuggetId(null);
    setNuggetError(null);
    setNuggetForm({ title: "", content_type: "tip", difficulty: "beginner", tags: "", estimated_seconds: 60 });
    setContentDraft(emptyContentDraft());
    setShowCreateNugget(true);
  };

  const openEditNugget = (nugget: Nugget) => {
    setEditingNuggetId(nugget.id);
    setNuggetError(null);
    setNuggetForm({
      title: nugget.title,
      content_type: nugget.content_type,
      difficulty: nugget.difficulty || "beginner",
      tags: (nugget.tags ?? []).join(", "),
      estimated_seconds: nugget.estimated_seconds ?? 60,
    });
    setContentDraft(draftFromContent(nugget.content_type, nugget.content));
    setShowCreateNugget(true);
  };

  const closeNuggetForm = () => {
    setShowCreateNugget(false);
    setEditingNuggetId(null);
  };

  const handleSaveNugget = async () => {
    setNuggetError(null);
    const built = buildNuggetContent(nuggetForm.content_type, contentDraft);
    if (built.error) {
      setNuggetError(built.error);
      return;
    }
    const content = built.content;
    const payload = {
      title: nuggetForm.title,
      content_type: nuggetForm.content_type,
      difficulty: nuggetForm.difficulty,
      content,
      tags: nuggetForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      estimated_seconds: nuggetForm.estimated_seconds,
    };

    setCreating(true);
    try {
      const res = editingNuggetId
        ? await fetch(`/api/microlearning/nuggets/${editingNuggetId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/microlearning/nuggets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNuggetError(data?.error || "Failed to save nugget");
        return;
      }

      const data = await res.json();
      setNuggets((prev) =>
        editingNuggetId ? prev.map((n) => (n.id === editingNuggetId ? { ...n, ...data } : n)) : [data, ...prev]
      );
      closeNuggetForm();
      setNuggetForm({ title: "", content_type: "tip", difficulty: "beginner", tags: "", estimated_seconds: 60 });
      setContentDraft(emptyContentDraft());
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
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => openEditNugget(nugget)}
            className="text-xs text-gray-500 hover:text-primary-700"
          >
            Edit
            <span className="sr-only">, {nugget.title}</span>
          </button>
          <button
            onClick={() => handleDeleteNugget(nugget.id)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Delete
            <span className="sr-only">, {nugget.title}</span>
          </button>
        </div>
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
            <Button onClick={openCreateNugget}>
              Create Nugget
            </Button>
          </div>

          {/* Create / Edit Nugget Form */}
          {showCreateNugget && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">{editingNuggetId ? "Edit nugget" : "New nugget"}</h3>
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
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 block">Content</label>
                {nuggetForm.content_type === "tip" && (
                  <>
                    <textarea value={contentDraft.text} onChange={(e) => setDraft({ text: e.target.value })} rows={3} placeholder="Tip text" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <input type="text" value={contentDraft.source} onChange={(e) => setDraft({ source: e.target.value })} placeholder="Source (optional)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </>
                )}
                {nuggetForm.content_type === "flashcard" && (
                  <>
                    <input type="text" value={contentDraft.front} onChange={(e) => setDraft({ front: e.target.value })} placeholder="Front (prompt)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <textarea value={contentDraft.back} onChange={(e) => setDraft({ back: e.target.value })} rows={2} placeholder="Back (answer)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </>
                )}
                {nuggetForm.content_type === "quiz" && (
                  <>
                    <input type="text" value={contentDraft.question} onChange={(e) => setDraft({ question: e.target.value })} placeholder="Question" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <p className="text-xs text-gray-500">Select the radio next to the correct answer.</p>
                    {contentDraft.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="quiz-correct" checked={contentDraft.correct_answer === i} onChange={() => setDraft({ correct_answer: i })} className="text-primary-600" aria-label={`Mark option ${i + 1} correct`} />
                        <input type="text" value={opt} onChange={(e) => setQuizOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        {contentDraft.options.length > 2 && (
                          <button type="button" onClick={() => setContentDraft((p) => ({ ...p, options: p.options.filter((_, idx) => idx !== i), correct_answer: Math.max(0, p.correct_answer >= i ? p.correct_answer - 1 : p.correct_answer) }))} className="text-gray-400 hover:text-red-600" aria-label="Remove option"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => setContentDraft((p) => ({ ...p, options: [...p.options, ""] }))}><Plus className="h-3 w-3" /> Add option</Button>
                    <textarea value={contentDraft.explanation} onChange={(e) => setDraft({ explanation: e.target.value })} rows={2} placeholder="Explanation (optional)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </>
                )}
                {nuggetForm.content_type === "video_clip" && (
                  <>
                    <input type="url" value={contentDraft.url} onChange={(e) => setDraft({ url: e.target.value })} placeholder="Video URL" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <input type="text" value={contentDraft.caption} onChange={(e) => setDraft({ caption: e.target.value })} placeholder="Caption (optional)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </>
                )}
                {nuggetForm.content_type === "infographic" && (
                  <>
                    <input type="url" value={contentDraft.image_url} onChange={(e) => setDraft({ image_url: e.target.value })} placeholder="Image URL" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <input type="text" value={contentDraft.caption} onChange={(e) => setDraft({ caption: e.target.value })} placeholder="Caption (optional)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </>
                )}
                {nuggetForm.content_type === "checklist" && (
                  <>
                    {contentDraft.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="text" value={item} onChange={(e) => setChecklistItem(i, e.target.value)} placeholder={`Item ${i + 1}`} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        {contentDraft.items.length > 1 && (
                          <button type="button" onClick={() => setContentDraft((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))} className="text-gray-400 hover:text-red-600" aria-label="Remove item"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => setContentDraft((p) => ({ ...p, items: [...p.items, ""] }))}><Plus className="h-3 w-3" /> Add item</Button>
                  </>
                )}
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
              {nuggetError && <p className="text-sm text-red-600">{nuggetError}</p>}
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={closeNuggetForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveNugget}
                  disabled={creating || !nuggetForm.title}
                >
                  {creating ? "Saving..." : editingNuggetId ? "Save Changes" : "Create"}
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
