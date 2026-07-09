"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ClipboardCheck, CheckCircle2, Inbox } from "lucide-react";

interface PendingAnswer {
  question_id: string;
  question_text: string;
  text_answer: string;
  points: number;
}
interface QueueItem {
  id: string;
  learner_name: string;
  learner_email: string | null;
  assessment_title: string;
  completed_at: string | null;
  pending_answers: PendingAnswer[];
}

export default function GradingClient() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Record<string, Record<string, string>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assessments/grading");
      if (res.ok) setQueue((await res.json()).queue ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setGrade = (attemptId: string, questionId: string, value: string) =>
    setGrades((g) => ({ ...g, [attemptId]: { ...(g[attemptId] ?? {}), [questionId]: value } }));

  const submit = async (item: QueueItem) => {
    setSavingId(item.id);
    try {
      const gradeEntries = item.pending_answers.map((a) => ({
        question_id: a.question_id,
        awarded_points: Number(grades[item.id]?.[a.question_id] ?? 0) || 0,
      }));
      const res = await fetch("/api/assessments/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: item.id, grades: gradeEntries }),
      });
      if (res.ok) await load();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Exam Grading</h1>
        <p className="mt-1 text-sm text-gray-500">Award points to written answers awaiting manual grading.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : queue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">Nothing to grade — the queue is empty.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-gray-900">
                    <ClipboardCheck className="h-4 w-4 text-primary-600" /> {item.assessment_title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.learner_name}{item.learner_email ? ` · ${item.learner_email}` : ""}
                    {item.completed_at ? ` · ${new Date(item.completed_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {item.pending_answers.map((a) => (
                  <div key={a.question_id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-800">{a.question_text}</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-md bg-white p-2 text-sm text-gray-600">{a.text_answer || <span className="text-gray-500">(no answer)</span>}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-gray-500">Award points (max {a.points})</label>
                      <input
                        type="number"
                        min={0}
                        max={a.points}
                        value={grades[item.id]?.[a.question_id] ?? ""}
                        onChange={(e) => setGrade(item.id, a.question_id, e.target.value)}
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => submit(item)}
                  disabled={savingId === item.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {savingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save grade
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
