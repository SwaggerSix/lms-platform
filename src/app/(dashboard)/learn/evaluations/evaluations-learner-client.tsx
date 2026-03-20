"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { CheckCircle, Clock, ClipboardList } from "lucide-react";

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-blue-100 text-blue-800",
  2: "bg-green-100 text-green-800",
  3: "bg-amber-100 text-amber-800",
  4: "bg-purple-100 text-purple-800",
};

const LEVEL_NAMES: Record<number, string> = {
  1: "Reaction",
  2: "Learning",
  3: "Behavior",
  4: "Results",
};

type Question = {
  id: string;
  text: string;
  type: "rating" | "text" | "multiple_choice" | "yes_no" | "nps";
  required: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
};

type Assignment = {
  id: string;
  status: "pending" | "completed" | "expired";
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  template: {
    id: string;
    name: string;
    description?: string;
    level: number;
    questions: Question[];
  } | null;
  course: { id: string; title: string; thumbnail_url?: string } | null;
};

interface Props {
  assignments: Assignment[];
}

export default function EvaluationsLearnerClient({ assignments: initialAssignments }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pending = assignments.filter(a => a.status === "pending");
  const completed = assignments.filter(a => a.status === "completed");

  function openAssignment(assignment: Assignment) {
    setActiveAssignment(assignment);
    setAnswers({});
    setSubmitError(null);
  }

  function setAnswer(questionId: string, value: unknown) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  function isComplete() {
    if (!activeAssignment?.template) return false;
    const required = activeAssignment.template.questions.filter(q => q.required);
    return required.every(q => answers[q.id] !== undefined && answers[q.id] !== "");
  }

  async function submitResponse() {
    if (!activeAssignment) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/evaluations/assignments/${activeAssignment.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) {
        setAssignments(prev =>
          prev.map(a =>
            a.id === activeAssignment.id
              ? { ...a, status: "completed" as const, completed_at: new Date().toISOString() }
              : a
          )
        );
        setActiveAssignment(null);
      } else {
        const err = await res.json();
        setSubmitError(err.error ?? "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Evaluations</h1>
        <p className="text-sm text-gray-500 mt-1">Complete your post-training surveys</p>
      </div>

      {/* Pending */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              You have no pending evaluations.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {pending.map(a => (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <ClipboardList className="h-8 w-8 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{a.template?.name ?? "Evaluation"}</p>
                      <p className="text-sm text-gray-500 truncate">{a.course?.title}</p>
                      {a.due_at && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Due {new Date(a.due_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {a.template && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${LEVEL_COLORS[a.template.level]}`}>
                        L{a.template.level} {LEVEL_NAMES[a.template.level]}
                      </span>
                    )}
                    <Button size="sm" onClick={() => openAssignment(a)}>
                      Start
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" /> Completed ({completed.length})
          </h2>
          <div className="grid gap-3">
            {completed.map(a => (
              <Card key={a.id} className="opacity-70">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle className="h-8 w-8 text-green-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-700 truncate">{a.template?.name ?? "Evaluation"}</p>
                      <p className="text-sm text-gray-500 truncate">{a.course?.title}</p>
                      {a.completed_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Completed {new Date(a.completed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="success">Submitted</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Survey Modal */}
      <Modal
        isOpen={!!activeAssignment}
        onClose={() => setActiveAssignment(null)}
        title={activeAssignment?.template?.name ?? "Evaluation"}
        size="lg"
      >
        {activeAssignment?.template?.description && (
          <p className="text-sm text-gray-500 mb-4 -mt-2">{activeAssignment.template.description}</p>
        )}

        <div className="space-y-6">
          {activeAssignment?.template?.questions.map((q, idx) => (
            <div key={q.id} className="space-y-2">
              <label className="block text-sm font-medium text-gray-900">
                {idx + 1}. {q.text}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <QuestionInput question={q} value={answers[q.id]} onChange={v => setAnswer(q.id, v)} />
            </div>
          ))}
        </div>

        {submitError && (
          <p className="text-sm text-red-600 mt-4">{submitError}</p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setActiveAssignment(null)}>Cancel</Button>
          <Button onClick={submitResponse} disabled={!isComplete() || submitting} loading={submitting}>
            Submit Evaluation
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function QuestionInput({ question, value, onChange }: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === "text") {
    return (
      <Textarea
        value={(value as string) ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder="Your answer..."
        rows={3}
      />
    );
  }

  if (question.type === "rating") {
    const min = question.scale_min ?? 1;
    const max = question.scale_max ?? 5;
    return (
      <div className="space-y-1">
        <div className="flex gap-2">
          {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-10 h-10 rounded-lg border-2 text-sm font-medium transition-colors ${
                value === n
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-gray-200 hover:border-indigo-300 text-gray-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {(question.scale_min_label || question.scale_max_label) && (
          <div className="flex justify-between text-xs text-gray-400 px-1">
            <span>{question.scale_min_label}</span>
            <span>{question.scale_max_label}</span>
          </div>
        )}
      </div>
    );
  }

  if (question.type === "nps") {
    return (
      <div className="space-y-1">
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 11 }, (_, i) => i).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-9 h-9 rounded border text-sm font-medium transition-colors ${
                value === n
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-gray-200 hover:border-indigo-300 text-gray-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <span>Not at all likely</span>
          <span>Extremely likely</span>
        </div>
      </div>
    );
  }

  if (question.type === "multiple_choice" && question.options) {
    return (
      <div className="space-y-2">
        {question.options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
              value === opt
                ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "yes_no") {
    return (
      <div className="flex gap-3">
        {["yes", "no"].map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-6 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-colors ${
              value === opt
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-gray-200 hover:border-indigo-300 text-gray-700"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  return null;
}
