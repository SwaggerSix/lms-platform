"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

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
  type: string;
  options?: string[];
};

type Assignment = {
  id: string;
  status: string;
  completed_at: string | null;
  user: { id: string; first_name: string; last_name: string; email: string } | null;
  template: { id: string; name: string; level: number; questions: Question[] } | null;
  response: Array<{ id: string; answers: Record<string, unknown>; submitted_at: string }> | null;
};

interface Props {
  course: { id: string; title: string };
  assignments: Assignment[];
}

export default function EvaluationReportClient({ course, assignments }: Props) {
  const byTemplate = useMemo(() => {
    const map: Record<string, {
      template: NonNullable<Assignment["template"]>;
      total: number;
      completed: number;
      answers: Record<string, unknown[]>;
    }> = {};

    for (const a of assignments) {
      if (!a.template) continue;
      if (!map[a.template.id]) {
        map[a.template.id] = { template: a.template, total: 0, completed: 0, answers: {} };
        for (const q of a.template.questions ?? []) {
          map[a.template.id].answers[q.id] = [];
        }
      }
      map[a.template.id].total++;
      if (a.status === "completed" && a.response && a.response.length > 0) {
        map[a.template.id].completed++;
        const ans = a.response[0].answers;
        for (const [qId, val] of Object.entries(ans)) {
          if (map[a.template.id].answers[qId]) {
            map[a.template.id].answers[qId].push(val);
          }
        }
      }
    }
    return Object.values(map);
  }, [assignments]);

  const totalAssigned = assignments.length;
  const totalCompleted = assignments.filter(a => a.status === "completed").length;
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/evaluations" className="text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-sm text-gray-500">Evaluation Report</p>
          <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{totalAssigned}</p>
              <p className="text-sm text-gray-500">Total Assigned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{totalCompleted}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{completionRate}%</p>
              <p className="text-sm text-gray-500">Completion Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-template breakdowns */}
      {byTemplate.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No evaluation responses yet for this course.
          </CardContent>
        </Card>
      ) : (
        byTemplate.map(({ template, total, completed, answers }) => (
          <Card key={template.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${LEVEL_COLORS[template.level]}`}>
                  Level {template.level} — {LEVEL_NAMES[template.level]}
                </span>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <span className="ml-auto text-sm text-gray-500">
                  {completed}/{total} responses
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(template.questions ?? []).map(q => {
                const qAnswers = answers[q.id] ?? [];
                return (
                  <div key={q.id} className="border rounded-lg p-4 space-y-2">
                    <p className="font-medium text-gray-900 text-sm">{q.text}</p>
                    {qAnswers.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No responses yet</p>
                    ) : ["rating", "nps"].includes(q.type) ? (
                      <RatingQuestionSummary answers={qAnswers as number[]} type={q.type} />
                    ) : q.type === "multiple_choice" && q.options ? (
                      <MultipleChoiceSummary answers={qAnswers as string[]} options={q.options} />
                    ) : q.type === "yes_no" ? (
                      <YesNoSummary answers={qAnswers as string[]} />
                    ) : (
                      <TextAnswersList answers={qAnswers as string[]} />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function RatingQuestionSummary({ answers, type }: { answers: number[]; type: string }) {
  const nums = answers.filter(a => typeof a === "number");
  const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "—";
  const max = type === "nps" ? 10 : 5;

  const counts: Record<number, number> = {};
  for (const n of nums) counts[n] = (counts[n] ?? 0) + 1;

  return (
    <div className="space-y-2">
      <p className="text-2xl font-bold text-gray-900">{avg} <span className="text-sm text-gray-500 font-normal">/ {max} avg</span></p>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map(v => (
          <div key={v} className="text-xs text-gray-600">
            {v}: <span className="font-medium">{counts[v] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultipleChoiceSummary({ answers, options }: { answers: string[]; options: string[] }) {
  const counts: Record<string, number> = {};
  for (const a of answers) counts[a] = (counts[a] ?? 0) + 1;
  const total = answers.length;

  return (
    <div className="space-y-1">
      {options.map(opt => {
        const count = counts[opt] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={opt} className="flex items-center gap-3">
            <span className="text-sm text-gray-700 w-40 truncate">{opt}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500 w-12 text-right">{count} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

function YesNoSummary({ answers }: { answers: string[] }) {
  const yes = answers.filter(a => a === "yes").length;
  const no = answers.filter(a => a === "no").length;
  const total = answers.length;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;

  return (
    <div className="flex gap-6">
      <div className="text-center">
        <p className="text-xl font-bold text-green-600">{yes}</p>
        <p className="text-xs text-gray-500">Yes ({yesPct}%)</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-red-500">{no}</p>
        <p className="text-xs text-gray-500">No ({100 - yesPct}%)</p>
      </div>
    </div>
  );
}

function TextAnswersList({ answers }: { answers: string[] }) {
  const visible = answers.slice(0, 5);
  return (
    <ul className="space-y-1">
      {visible.map((a, i) => (
        <li key={i} className="text-sm text-gray-700 border-l-2 border-gray-200 pl-3 py-0.5">{a}</li>
      ))}
      {answers.length > 5 && (
        <li className="text-xs text-gray-400">+ {answers.length - 5} more responses</li>
      )}
    </ul>
  );
}
