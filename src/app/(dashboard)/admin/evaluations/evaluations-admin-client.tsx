"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, BarChart2 } from "lucide-react";
import Link from "next/link";

const KIRKPATRICK_LEVELS = [
  { value: "1", label: "Level 1 — Reaction" },
  { value: "2", label: "Level 2 — Learning" },
  { value: "3", label: "Level 3 — Behavior" },
  { value: "4", label: "Level 4 — Results" },
];

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-blue-100 text-blue-800",
  2: "bg-green-100 text-green-800",
  3: "bg-amber-100 text-amber-800",
  4: "bg-purple-100 text-purple-800",
};

type StoredQuestion = {
  id?: string;
  text?: string;
  type?: string;
  required?: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
};

type Template = {
  id: string;
  name: string;
  description?: string;
  level: number;
  questions?: StoredQuestion[] | null;
  is_active: boolean;
  external_provider?: string | null;
  surveycraft_slug?: string | null;
  created_at: string;
};

const SURVEY_SOURCES = [
  { value: "native", label: "Build in the LMS" },
  { value: "surveycraft", label: "Use a SurveyCraft survey" },
];

const QUESTION_TYPES = [
  { value: "rating", label: "Rating scale" },
  { value: "nps", label: "NPS (0–10)" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "yes_no", label: "Yes / No" },
  { value: "text", label: "Free text" },
];

type BuilderQuestion = {
  id: string;
  text: string;
  type: "rating" | "text" | "multiple_choice" | "yes_no" | "nps";
  required: boolean;
  options: string[];
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
};

function newQuestion(): BuilderQuestion {
  return { id: crypto.randomUUID(), text: "", type: "rating", required: true, options: ["", ""], scale_min: 1, scale_max: 5 };
}

/** Map a builder question to the stored/validated shape, dropping fields that
 * don't apply to its type. */
function serializeQuestion(q: BuilderQuestion) {
  const base: Record<string, unknown> = { id: q.id, text: q.text.trim(), type: q.type, required: q.required };
  if (q.type === "multiple_choice") {
    base.options = q.options.map(o => o.trim()).filter(Boolean);
  }
  if (q.type === "rating" || q.type === "nps") {
    base.scale_min = q.type === "nps" ? 0 : q.scale_min ?? 1;
    base.scale_max = q.type === "nps" ? 10 : q.scale_max ?? 5;
    if (q.scale_min_label?.trim()) base.scale_min_label = q.scale_min_label.trim();
    if (q.scale_max_label?.trim()) base.scale_max_label = q.scale_max_label.trim();
  }
  return base;
}

/** Map a stored question back into an editable builder question, filling in the
 * defaults the editor UI needs (e.g. two option slots for multiple choice). */
function deserializeQuestion(q: StoredQuestion): BuilderQuestion {
  const type = (QUESTION_TYPES.some(t => t.value === q.type) ? q.type : "rating") as BuilderQuestion["type"];
  const options = Array.isArray(q.options) && q.options.length ? [...q.options] : ["", ""];
  return {
    id: q.id || crypto.randomUUID(),
    text: q.text ?? "",
    type,
    required: q.required ?? true,
    options: options.length >= 2 ? options : [...options, ...Array(2 - options.length).fill("")],
    scale_min: q.scale_min ?? 1,
    scale_max: q.scale_max ?? 5,
    scale_min_label: q.scale_min_label,
    scale_max_label: q.scale_max_label,
  };
}

type Trigger = {
  id: string;
  delay_days: number;
  is_active: boolean;
  created_at: string;
  course: { id: string; title: string } | null;
  template: { id: string; name: string; level: number } | null;
};

type Course = { id: string; title: string };

interface Props {
  templates: Template[];
  triggers: Trigger[];
  courses: Course[];
}

export default function EvaluationsAdminClient({ templates: initialTemplates, triggers: initialTriggers, courses }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [triggers, setTriggers] = useState<Trigger[]>(initialTriggers);
  const [activeTab, setActiveTab] = useState("templates");

  // Template dialog state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", description: "", level: "1", source: "native", surveycraft_slug: "" });
  const [questions, setQuestions] = useState<BuilderQuestion[]>([newQuestion()]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setTemplateError(null);
    setTemplateForm({ name: "", description: "", level: "1", source: "native", surveycraft_slug: "" });
    setQuestions([newQuestion()]);
    setShowTemplateDialog(true);
  };

  const openEdit = (template: Template) => {
    setEditingId(template.id);
    setTemplateError(null);
    setTemplateForm({
      name: template.name,
      description: template.description ?? "",
      level: String(template.level),
      source: template.external_provider === "surveycraft" ? "surveycraft" : "native",
      surveycraft_slug: template.surveycraft_slug ?? "",
    });
    const stored = Array.isArray(template.questions) ? template.questions : [];
    setQuestions(stored.length ? stored.map(deserializeQuestion) : [newQuestion()]);
    setShowTemplateDialog(true);
  };

  const updateQuestion = (id: string, patch: Partial<BuilderQuestion>) =>
    setQuestions(prev => prev.map(q => (q.id === id ? { ...q, ...patch } : q)));
  const removeQuestion = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id));
  const setOption = (qid: string, idx: number, value: string) =>
    setQuestions(prev => prev.map(q => (q.id === qid ? { ...q, options: q.options.map((o, i) => (i === idx ? value : o)) } : q)));
  const addOption = (qid: string) =>
    setQuestions(prev => prev.map(q => (q.id === qid ? { ...q, options: [...q.options, ""] } : q)));
  const removeOption = (qid: string, idx: number) =>
    setQuestions(prev => prev.map(q => (q.id === qid ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q)));

  // Trigger dialog state
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [triggerForm, setTriggerForm] = useState({ course_id: "", template_id: "", delay_days: "0" });
  const [savingTrigger, setSavingTrigger] = useState(false);

  async function saveTemplate() {
    setTemplateError(null);

    let builtQuestions: Record<string, unknown>[] = [];
    if (templateForm.source === "native") {
      const withText = questions.filter(q => q.text.trim());
      if (withText.length === 0) {
        setTemplateError("Add at least one question, or switch the source to SurveyCraft.");
        return;
      }
      const badChoice = withText.find(
        q => q.type === "multiple_choice" && q.options.map(o => o.trim()).filter(Boolean).length < 2
      );
      if (badChoice) {
        setTemplateError("Multiple-choice questions need at least two options.");
        return;
      }
      builtQuestions = withText.map(serializeQuestion);
    }

    const payload = {
      name: templateForm.name,
      description: templateForm.description || undefined,
      level: parseInt(templateForm.level),
      questions: builtQuestions,
      external_provider: templateForm.source === "surveycraft" ? "surveycraft" : null,
      surveycraft_slug: templateForm.source === "surveycraft" ? templateForm.surveycraft_slug.trim() : null,
    };

    setSavingTemplate(true);
    try {
      const res = editingId
        ? await fetch(`/api/evaluations/templates/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/evaluations/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, is_active: true }),
          });
      if (res.ok) {
        const saved = await res.json();
        setTemplates(prev =>
          editingId ? prev.map(t => (t.id === editingId ? { ...t, ...saved } : t)) : [saved, ...prev]
        );
        setShowTemplateDialog(false);
        setEditingId(null);
        setTemplateForm({ name: "", description: "", level: "1", source: "native", surveycraft_slug: "" });
        setQuestions([newQuestion()]);
      } else {
        const data = await res.json().catch(() => null);
        setTemplateError(data?.error ?? "Failed to save template. Please try again.");
      }
    } catch {
      setTemplateError("Network error. Please try again.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function toggleTemplate(id: string, currentActive: boolean) {
    const res = await fetch(`/api/evaluations/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    if (res.ok) {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentActive } : t));
    }
  }

  async function deleteTemplate(id: string) {
    const res = await fetch(`/api/evaluations/templates/${id}`, { method: "DELETE" });
    if (res.ok) setTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function createTrigger() {
    setSavingTrigger(true);
    try {
      const res = await fetch("/api/evaluations/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: triggerForm.course_id,
          template_id: triggerForm.template_id,
          delay_days: parseInt(triggerForm.delay_days),
          is_active: true,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTriggers(prev => [created, ...prev]);
        setShowTriggerDialog(false);
        setTriggerForm({ course_id: "", template_id: "", delay_days: "0" });
      }
    } finally {
      setSavingTrigger(false);
    }
  }

  async function toggleTrigger(id: string, currentActive: boolean) {
    const res = await fetch(`/api/evaluations/triggers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    if (res.ok) {
      setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentActive } : t));
    }
  }

  async function deleteTrigger(id: string) {
    const res = await fetch(`/api/evaluations/triggers/${id}`, { method: "DELETE" });
    if (res.ok) setTriggers(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Training Evaluations</h1>
        <p className="text-sm text-gray-500 mt-1">Manage survey templates and course triggers</p>
      </div>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="triggers">Course Triggers</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>

            {templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  No evaluation templates yet. Create one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {templates.map(template => (
                  <Card key={template.id} className={!template.is_active ? "opacity-60" : ""}>
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${LEVEL_COLORS[template.level]}`}>
                          {KIRKPATRICK_LEVELS[template.level - 1]?.label}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate flex items-center gap-2">
                            {template.name}
                            {template.external_provider === "surveycraft" && (
                              <Badge variant="info" size="sm">SurveyCraft</Badge>
                            )}
                          </p>
                          {template.description && (
                            <p className="text-sm text-gray-500 truncate">{template.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => toggleTemplate(template.id, template.is_active)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${template.is_active ? "bg-primary-600" : "bg-gray-300"}`}
                          aria-label={template.is_active ? "Deactivate" : "Activate"}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${template.is_active ? "translate-x-4.5" : "translate-x-0.5"}`} />
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(template)} className="text-gray-500 hover:text-primary-700">
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                          className="text-gray-400 hover:text-red-600 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Triggers Tab */}
        <TabsContent value="triggers">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => setShowTriggerDialog(true)}
                disabled={templates.length === 0 || courses.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Trigger
              </Button>
            </div>

            {triggers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  No triggers configured. Assign a template to a course to start collecting evaluations.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {triggers.map(trigger => (
                  <Card key={trigger.id} className={!trigger.is_active ? "opacity-60" : ""}>
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {trigger.course?.title ?? "Unknown course"}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {trigger.template?.name ?? "Unknown template"}
                          {" · "}
                          {trigger.delay_days === 0 ? "Sent immediately" : `Sent after ${trigger.delay_days} day${trigger.delay_days === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {trigger.course?.id && (
                          <Link href={`/admin/evaluations/reports/${trigger.course.id}`}>
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-600 w-8 p-0">
                              <BarChart2 className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <button
                          onClick={() => toggleTrigger(trigger.id, trigger.is_active)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${trigger.is_active ? "bg-primary-600" : "bg-gray-300"}`}
                          aria-label={trigger.is_active ? "Deactivate" : "Activate"}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${trigger.is_active ? "translate-x-4.5" : "translate-x-0.5"}`} />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTrigger(trigger.id)}
                          className="text-gray-400 hover:text-red-600 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Template Modal */}
      <Modal
        isOpen={showTemplateDialog}
        onClose={() => { setShowTemplateDialog(false); setEditingId(null); }}
        title={editingId ? "Edit Evaluation Template" : "New Evaluation Template"}
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <Input
              value={templateForm.name}
              onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Post-Training Reaction Survey"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
            <Textarea
              value={templateForm.description}
              onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What this survey is for..."
              rows={3}
            />
          </div>
          <Select
            label="Kirkpatrick Level"
            value={templateForm.level}
            options={KIRKPATRICK_LEVELS}
            onChange={v => setTemplateForm(f => ({ ...f, level: v }))}
          />
          <Select
            label="Survey source"
            value={templateForm.source}
            options={SURVEY_SOURCES}
            onChange={v => setTemplateForm(f => ({ ...f, source: v }))}
          />
          {templateForm.source === "surveycraft" && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">SurveyCraft survey link or ID</label>
              <Input
                value={templateForm.surveycraft_slug}
                onChange={e => setTemplateForm(f => ({ ...f, surveycraft_slug: e.target.value }))}
                placeholder="e.g. post-training-feedback"
              />
              <p className="text-xs text-gray-500">
                Paste the survey&apos;s link ending (the part after <span className="font-mono">/s/</span>) from SurveyCraft.
              </p>
            </div>
          )}
          {templateForm.source === "native" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Questions</label>
                <Button variant="outline" size="sm" onClick={() => setQuestions(prev => [...prev, newQuestion()])}>
                  <Plus className="h-3.5 w-3.5" /> Add question
                </Button>
              </div>
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-sm font-medium text-gray-400">{idx + 1}.</span>
                    <div className="flex-1">
                      <Input
                        value={q.text}
                        onChange={e => updateQuestion(q.id, { text: e.target.value })}
                        placeholder="Question text"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="mt-2 text-gray-400 hover:text-red-600"
                      aria-label="Remove question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pl-6">
                    <div className="w-48">
                      <Select
                        value={q.type}
                        options={QUESTION_TYPES}
                        onChange={v => updateQuestion(q.id, { type: v as BuilderQuestion["type"] })}
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      Required
                    </label>
                  </div>
                  {q.type === "multiple_choice" && (
                    <div className="space-y-2 pl-6">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <Input
                            value={opt}
                            onChange={e => setOption(q.id, oIdx, e.target.value)}
                            placeholder={`Option ${oIdx + 1}`}
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(q.id, oIdx)}
                              className="text-gray-400 hover:text-red-600"
                              aria-label="Remove option"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => addOption(q.id)}>
                        <Plus className="h-3 w-3" /> Add option
                      </Button>
                    </div>
                  )}
                  {q.type === "rating" && (
                    <div className="flex flex-wrap items-center gap-3 pl-6 text-sm">
                      <label className="flex items-center gap-1.5 text-gray-600">
                        Min
                        <input
                          type="number"
                          value={q.scale_min ?? 1}
                          onChange={e => updateQuestion(q.id, { scale_min: parseInt(e.target.value) || 0 })}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-1"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-600">
                        Max
                        <input
                          type="number"
                          value={q.scale_max ?? 5}
                          onChange={e => updateQuestion(q.id, { scale_max: parseInt(e.target.value) || 0 })}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-1"
                        />
                      </label>
                      <Input
                        value={q.scale_min_label ?? ""}
                        onChange={e => updateQuestion(q.id, { scale_min_label: e.target.value })}
                        placeholder="Low label (optional)"
                      />
                      <Input
                        value={q.scale_max_label ?? ""}
                        onChange={e => updateQuestion(q.id, { scale_max_label: e.target.value })}
                        placeholder="High label (optional)"
                      />
                    </div>
                  )}
                  {q.type === "nps" && (
                    <p className="pl-6 text-xs text-gray-500">A 0–10 Net Promoter Score scale.</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {templateError && (
            <p className="text-sm text-red-600">{templateError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setShowTemplateDialog(false); setEditingId(null); }}>Cancel</Button>
            <Button
              onClick={saveTemplate}
              disabled={!templateForm.name || (templateForm.source === "surveycraft" && !templateForm.surveycraft_slug.trim()) || savingTemplate}
              loading={savingTemplate}
            >
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Trigger Modal */}
      <Modal
        isOpen={showTriggerDialog}
        onClose={() => setShowTriggerDialog(false)}
        title="New Course Trigger"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Course"
            value={triggerForm.course_id}
            placeholder="Select a course..."
            options={courses.map(c => ({ value: c.id, label: c.title }))}
            onChange={v => setTriggerForm(f => ({ ...f, course_id: v }))}
          />
          <Select
            label="Evaluation Template"
            value={triggerForm.template_id}
            placeholder="Select a template..."
            options={templates.filter(t => t.is_active).map(t => ({
              value: t.id,
              label: `${t.name} (${KIRKPATRICK_LEVELS[t.level - 1]?.label})`,
            }))}
            onChange={v => setTriggerForm(f => ({ ...f, template_id: v }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Send after (days)</label>
            <Input
              type="number"
              min={0}
              value={triggerForm.delay_days}
              onChange={e => setTriggerForm(f => ({ ...f, delay_days: e.target.value }))}
            />
            <p className="text-xs text-gray-500">0 = send immediately on course completion</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowTriggerDialog(false)}>Cancel</Button>
            <Button
              onClick={createTrigger}
              disabled={!triggerForm.course_id || !triggerForm.template_id || savingTrigger}
              loading={savingTrigger}
            >
              Create Trigger
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
