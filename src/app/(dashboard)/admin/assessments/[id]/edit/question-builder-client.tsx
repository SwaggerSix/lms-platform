"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, ArrowUp, ArrowDown, Loader2, Save, ArrowLeft,
  CheckCircle2, GripVertical,
} from "lucide-react";

export type BuilderQType =
  | "multiple_choice"
  | "multi_select"
  | "true_false"
  | "fill_blank"
  | "essay";

export interface BuilderOption {
  text: string;
  is_correct: boolean;
}

export interface BuilderQuestion {
  question_text: string;
  question_type: BuilderQType;
  points: number;
  explanation: string;
  correct_answer: string;
  options: BuilderOption[];
}

const TYPE_LABELS: Record<BuilderQType, string> = {
  multiple_choice: "Multiple choice (one answer)",
  multi_select: "Multiple select (many answers)",
  true_false: "True / False",
  fill_blank: "Fill in the blank",
  essay: "Essay / written (manually graded)",
};

const AUTO_GRADED: BuilderQType[] = ["multiple_choice", "multi_select", "true_false"];

function blankQuestion(type: BuilderQType = "multiple_choice"): BuilderQuestion {
  if (type === "true_false") {
    return {
      question_text: "",
      question_type: type,
      points: 1,
      explanation: "",
      correct_answer: "",
      options: [
        { text: "True", is_correct: true },
        { text: "False", is_correct: false },
      ],
    };
  }
  return {
    question_text: "",
    question_type: type,
    points: 1,
    explanation: "",
    correct_answer: "",
    options:
      type === "multiple_choice" || type === "multi_select"
        ? [
            { text: "", is_correct: true },
            { text: "", is_correct: false },
          ]
        : [],
  };
}

export default function QuestionBuilderClient({
  assessmentId,
  title,
  initialStatus,
  initialQuestions,
}: {
  assessmentId: string;
  title: string;
  initialStatus: "draft" | "published" | "archived";
  initialQuestions: BuilderQuestion[];
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<BuilderQuestion[]>(initialQuestions);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<BuilderQuestion>) =>
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const changeType = (idx: number, type: BuilderQType) =>
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...blankQuestion(type), question_text: q.question_text, points: q.points, explanation: q.explanation } : q)));

  const move = (idx: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const next = [...qs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return qs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const remove = (idx: number) => setQuestions((qs) => qs.filter((_, i) => i !== idx));

  const setOption = (qi: number, oi: number, patch: Partial<BuilderOption>) =>
    setQuestions((qs) =>
      qs.map((q, i) => (i === qi ? { ...q, options: q.options.map((o, k) => (k === oi ? { ...o, ...patch } : o)) } : q))
    );

  const setSingleCorrect = (qi: number, oi: number) =>
    setQuestions((qs) =>
      qs.map((q, i) => (i === qi ? { ...q, options: q.options.map((o, k) => ({ ...o, is_correct: k === oi })) } : q))
    );

  const addOption = (qi: number) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, options: [...q.options, { text: "", is_correct: false }] } : q)));

  const removeOption = (qi: number, oi: number) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, options: q.options.filter((_, k) => k !== oi) } : q)));

  const validate = (): string | null => {
    if (questions.length === 0) return "Add at least one question.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) return `Question ${i + 1} needs text.`;
      if (q.question_type === "multiple_choice" || q.question_type === "multi_select" || q.question_type === "true_false") {
        if (q.options.length < 2) return `Question ${i + 1} needs at least two options.`;
        if (q.options.some((o) => !o.text.trim())) return `Question ${i + 1} has an empty option.`;
        if (!q.options.some((o) => o.is_correct)) return `Question ${i + 1} needs a correct answer marked.`;
      }
      if (q.question_type === "fill_blank" && !q.correct_answer.trim()) {
        return `Question ${i + 1} needs an accepted answer.`;
      }
    }
    return null;
  };

  const save = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/assessments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: assessmentId,
          status,
          questions: questions.map((q) => ({
            question_text: q.question_text.trim(),
            question_type: q.question_type,
            points: q.points,
            explanation: q.explanation.trim(),
            correct_answer: q.question_type === "fill_blank" ? q.correct_answer.trim() : null,
            options: q.options.map((o) => ({ text: o.text.trim(), is_correct: o.is_correct })),
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save.");
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/assessments" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to assessments
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{questions.length} question{questions.length === 1 ? "" : "s"} · {totalPoints} points</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
            title="Deploy status"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {savedAt && !error && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Saved at {savedAt}
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <GripVertical className="h-4 w-4 text-gray-300" /> Question {qi + 1}
                {!AUTO_GRADED.includes(q.question_type) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Manual grade</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(qi, -1)} disabled={qi === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => move(qi, 1)} disabled={qi === questions.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button onClick={() => remove(qi)} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <select
                value={q.question_type}
                onChange={(e) => changeType(qi, e.target.value as BuilderQType)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Points</label>
                <input
                  type="number"
                  min={0}
                  value={q.points}
                  onChange={(e) => update(qi, { points: Number(e.target.value) || 0 })}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                />
              </div>
            </div>

            <textarea
              value={q.question_text}
              onChange={(e) => update(qi, { question_text: e.target.value })}
              placeholder="Question text"
              rows={2}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            {/* Type-specific editor */}
            {(q.question_type === "multiple_choice" || q.question_type === "multi_select") && (
              <div className="space-y-2">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type={q.question_type === "multiple_choice" ? "radio" : "checkbox"}
                      name={`correct-${qi}`}
                      checked={o.is_correct}
                      onChange={() =>
                        q.question_type === "multiple_choice"
                          ? setSingleCorrect(qi, oi)
                          : setOption(qi, oi, { is_correct: !o.is_correct })
                      }
                      title="Mark correct"
                    />
                    <input
                      value={o.text}
                      onChange={(e) => setOption(qi, oi, { text: e.target.value })}
                      placeholder={`Option ${oi + 1}`}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                    <button onClick={() => removeOption(qi, oi)} disabled={q.options.length <= 2} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => addOption(qi)} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  <Plus className="h-3.5 w-3.5" /> Add option
                </button>
                <p className="text-[11px] text-gray-400">{q.question_type === "multiple_choice" ? "Select the single correct option." : "Tick all correct options."}</p>
              </div>
            )}

            {q.question_type === "true_false" && (
              <div className="flex gap-3">
                {q.options.map((o, oi) => (
                  <label key={oi} className="inline-flex items-center gap-1.5 text-sm">
                    <input type="radio" name={`tf-${qi}`} checked={o.is_correct} onChange={() => setSingleCorrect(qi, oi)} />
                    {o.text}
                  </label>
                ))}
              </div>
            )}

            {q.question_type === "fill_blank" && (
              <input
                value={q.correct_answer}
                onChange={(e) => update(qi, { correct_answer: e.target.value })}
                placeholder="Accepted answer"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            )}

            {q.question_type === "essay" && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">Written response — graded manually from the Exam Results / grading view.</p>
            )}

            <input
              value={q.explanation}
              onChange={(e) => update(qi, { explanation: e.target.value })}
              placeholder="Explanation shown after submission (optional)"
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus className="h-4 w-4" /> Add question
      </button>
    </div>
  );
}
