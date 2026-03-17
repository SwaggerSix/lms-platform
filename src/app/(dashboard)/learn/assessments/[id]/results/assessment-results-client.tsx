"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  RotateCcw,
  Clock,
  Target,
  Award,
  BarChart3,
} from "lucide-react";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReviewQuestion {
  id: string;
  text: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
}

export interface AssessmentResultsData {
  score: number;
  passed: boolean;
  timeTaken: string;
  correctCount: number;
  totalQuestions: number;
  passingScore: number;
  attemptsRemaining: number;
  assessmentId: string;
  reviewQuestions: ReviewQuestion[];
  showCorrectAnswers: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AssessmentResultsClient({ data }: { data: AssessmentResultsData }) {
  const {
    score,
    passed,
    timeTaken,
    correctCount,
    totalQuestions,
    passingScore,
    attemptsRemaining,
    assessmentId,
    reviewQuestions,
    showCorrectAnswers,
  } = data;

  const router = useRouter();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (id: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (expandedQuestions.size === reviewQuestions.length) {
      setExpandedQuestions(new Set());
    } else {
      setExpandedQuestions(new Set(reviewQuestions.map((q) => q.id)));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---- Score Display ---- */}
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {/* Circular Progress Ring */}
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke={passed ? "#4f46e5" : "#dc2626"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 70}
                strokeDashoffset={2 * Math.PI * 70 * (1 - score / 100)}
              />
            </svg>
            <span className="text-4xl font-bold text-gray-900">{score}%</span>
          </div>

          {/* Pass/Fail Badge */}
          <span
            className={cn(
              "mt-4 rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide",
              passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}
          >
            {passed ? "PASSED" : "FAILED"}
          </span>

          {/* Stats Row */}
          <div className="mt-6 grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              <span className="mt-1 text-lg font-bold text-gray-900">{score}%</span>
              <span className="text-xs text-gray-500">Score</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="mt-1 text-lg font-bold text-gray-900">{timeTaken}</span>
              <span className="text-xs text-gray-500">Time Taken</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3">
              <Target className="h-5 w-5 text-green-500" />
              <span className="mt-1 text-lg font-bold text-gray-900">{correctCount}/{totalQuestions}</span>
              <span className="text-xs text-gray-500">Correct</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3">
              <Award className="h-5 w-5 text-amber-500" />
              <span className="mt-1 text-lg font-bold text-gray-900">{passingScore}%</span>
              <span className="text-xs text-gray-500">Passing Score</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => router.push(`/learn/assessments/${assessmentId}`)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Retake Assessment
              <span className="text-xs text-gray-400">({attemptsRemaining} remaining)</span>
            </button>
            <button
              onClick={() => router.push("/learn/my-courses")}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Course
            </button>
          </div>
        </div>

        {/* ---- Summary Message ---- */}
        <div className={cn(
          "mt-6 rounded-xl border p-4",
          passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        )}>
          <p className={cn("text-sm", passed ? "text-green-800" : "text-red-800")}>
            {passed ? (
              <><strong>Great job!</strong> You scored above the passing threshold. Your certificate has been issued.</>
            ) : (
              <><strong>Keep trying!</strong> You did not meet the passing threshold. Review the questions below and try again.</>
            )}
          </p>
        </div>

        {/* ---- Question Review ---- */}
        {showCorrectAnswers && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Question Review</h2>
              <button
                onClick={expandAll}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                {expandedQuestions.size === reviewQuestions.length ? "Collapse All" : "Expand All"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {reviewQuestions.map((q) => {
                const isExpanded = expandedQuestions.has(q.id);
                return (
                  <div
                    key={q.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    {/* Accordion Header */}
                    <button
                      onClick={() => toggleQuestion(q.id)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        {q.isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          Q{reviewQuestions.indexOf(q) + 1}: {q.text}
                        </span>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            q.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}
                        >
                          {q.isCorrect ? "1/1" : "0/1"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-5 py-4">
                        <div className="space-y-2">
                          {q.options.map((option, idx) => {
                            const isUserAnswer = option === q.userAnswer;
                            const isCorrectAnswer = option === q.correctAnswer;
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm",
                                  isCorrectAnswer && "border border-green-200 bg-green-50",
                                  isUserAnswer && !q.isCorrect && option !== q.correctAnswer && "border border-red-200 bg-red-50",
                                  !isCorrectAnswer && !(isUserAnswer && !q.isCorrect) && "bg-gray-50"
                                )}
                              >
                                {isCorrectAnswer && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />}
                                {isUserAnswer && !q.isCorrect && option !== q.correctAnswer && (
                                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                                )}
                                {!isCorrectAnswer && !(isUserAnswer && !q.isCorrect) && (
                                  <div className="h-4 w-4 shrink-0" />
                                )}
                                <span
                                  className={cn(
                                    isCorrectAnswer ? "font-medium text-green-800" :
                                    isUserAnswer && !q.isCorrect ? "font-medium text-red-800" :
                                    "text-gray-600"
                                  )}
                                >
                                  {option}
                                </span>
                                {isUserAnswer && <span className="ml-auto text-xs text-gray-400">(Your answer)</span>}
                                {isCorrectAnswer && !isUserAnswer && <span className="ml-auto text-xs text-green-600">(Correct answer)</span>}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        <div className="mt-4 rounded-lg bg-blue-50 p-3">
                          <p className="text-sm text-blue-800">
                            <strong>Explanation:</strong> {q.explanation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
