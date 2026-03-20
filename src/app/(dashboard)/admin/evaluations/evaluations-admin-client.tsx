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

type Template = {
  id: string;
  name: string;
  description?: string;
  level: number;
  is_active: boolean;
  created_at: string;
};

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
  const [templateForm, setTemplateForm] = useState({ name: "", description: "", level: "1" });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Trigger dialog state
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [triggerForm, setTriggerForm] = useState({ course_id: "", template_id: "", delay_days: "0" });
  const [savingTrigger, setSavingTrigger] = useState(false);

  async function createTemplate() {
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/evaluations/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateForm.name,
          description: templateForm.description || undefined,
          level: parseInt(templateForm.level),
          questions: [],
          is_active: true,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTemplates(prev => [created, ...prev]);
        setShowTemplateDialog(false);
        setTemplateForm({ name: "", description: "", level: "1" });
      }
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
              <Button onClick={() => setShowTemplateDialog(true)}>
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
                          <p className="font-medium text-gray-900 truncate">{template.name}</p>
                          {template.description && (
                            <p className="text-sm text-gray-500 truncate">{template.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => toggleTemplate(template.id, template.is_active)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${template.is_active ? "bg-indigo-600" : "bg-gray-300"}`}
                          aria-label={template.is_active ? "Deactivate" : "Activate"}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${template.is_active ? "translate-x-4.5" : "translate-x-0.5"}`} />
                        </button>
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
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${trigger.is_active ? "bg-indigo-600" : "bg-gray-300"}`}
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

      {/* Create Template Modal */}
      <Modal
        isOpen={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        title="New Evaluation Template"
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
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={createTemplate} disabled={!templateForm.name || savingTemplate} loading={savingTemplate}>
              Create Template
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
