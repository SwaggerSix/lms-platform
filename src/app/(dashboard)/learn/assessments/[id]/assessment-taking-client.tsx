"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { trackEvent } from "@/lib/analytics/track";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: string;
  points: number;
  options: { label: string; value: string }[];
  sequence_order: number;
}

export interface AssessmentData {
  assessment: {
    id: string;
    title: string;
    description: string;
    passing_score: number;
    time_limit: number | null;
    max_attempts: number;
    question_count: number;
    course_title: string;
  };
  questions: AssessmentQuestion[];
  previousAttemptCount: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AssessmentTakingClient({ data, classId = null }: { data: AssessmentData; classId?: string | null }) {
  const { assessment, questions } = data;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  // Value is a string for single-choice/text questions, or string[] for multi-select.
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(
    assessment.time_limit ? assessment.time_limit * 60 : null
  );
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const question = questions[currentQuestion];
  const isAnswered = (qid: string) => {
    const v = answers[qid];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== "";
  };
  const answeredCount = questions.filter((q) => isAnswered(q.id)).length;
  const unansweredCount = questions.length - answeredCount;

  // Timer - only run when there is a time limit
  useEffect(() => {
    if (timeLeft === null) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when timer reaches 0
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  useEffect(() => {
    if (timeLeft === 0 && !autoSubmitted && !isSubmitting) {
      setAutoSubmitted(true);
      handleSubmit();
    }
  }, [timeLeft, autoSubmitted, isSubmitting]); // eslint-disable-line react-hooks/exhaustive-deps

  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const seconds = timeLeft !== null ? timeLeft % 60 : 0;

  const selectAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const toggleMultiAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [questionId]: next };
    });
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Convert answers to the API format, by question type.
      const formattedAnswers = Object.entries(answers).map(([questionId, value]) => {
        const q = questions.find((question) => question.id === questionId);
        const type = q?.question_type ?? "multiple_choice";
        if (type === "essay" || type === "fill_blank") {
          return { question_id: questionId, text_answer: Array.isArray(value) ? "" : value };
        }
        if (type === "multi_select") {
          const values = Array.isArray(value) ? value : [value];
          const indexes = values
            .map((v) => q?.options.findIndex((opt) => opt.value === v) ?? -1)
            .filter((i) => i >= 0);
          return { question_id: questionId, selected_options: indexes };
        }
        // single-choice (multiple_choice, true_false)
        const optionIndex = q?.options.findIndex((opt) => opt.value === value) ?? -1;
        return { question_id: questionId, selected_options: optionIndex >= 0 ? [optionIndex] : [] };
      });

      const res = await fetch("/api/assessments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessment.id,
          answers: formattedAnswers,
          class_id: classId ?? undefined,
          time_spent: assessment.time_limit && timeLeft !== null ? assessment.time_limit * 60 - timeLeft : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit assessment");
      }

      trackEvent("assessment_submitted", { assessment_id: assessment.id });
      window.location.href = `/learn/assessments/${assessment.id}/results`;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Max attempts check
  if (data.previousAttemptCount >= assessment.max_attempts) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Maximum attempts reached</h2>
          <p className="mt-2 text-sm text-gray-600">
            You have used all {assessment.max_attempts} attempt(s) for this assessment.
          </p>
          <a
            href={`/learn/assessments/${assessment.id}/results`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            View Results
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ---- Submit Confirmation Modal ---- */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        className="max-w-md"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Submit Assessment?</h3>
          <button onClick={() => setShowSubmitModal(false)} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-gray-600">
          <p>
            You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
          </p>
          {unansweredCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-yellow-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>You have {unansweredCount} unanswered question(s).</span>
            </div>
          )}
        </div>
        {submitError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => { setShowSubmitModal(false); setSubmitError(null); }}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Review Answers
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Assessment"}
          </button>
        </div>
      </Modal>

      {/* ---- Top Bar ---- */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{assessment.title}</h1>
            <p className="text-sm text-gray-500">{assessment.course_title}</p>
          </div>
          <div className="flex items-center gap-6">
            {timeLeft !== null && (
            <div className="flex items-center gap-2">
              <Clock className={cn("h-4 w-4", minutes < 5 ? "text-red-500" : "text-gray-500")} />
              <span className={cn("font-mono text-sm font-semibold", minutes < 5 ? "text-red-600" : "text-gray-900")}>
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
              <span className="text-xs text-gray-500">remaining</span>
            </div>
            )}
            <div className="hidden text-sm text-gray-500 sm:block">
              <span className="font-medium text-gray-900">{currentQuestion + 1}</span>/{questions.length} questions
            </div>
          </div>
        </div>
      </div>

      {/* ---- Main Content ---- */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Question Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700">
              Q{currentQuestion + 1}
            </span>
            <button
              onClick={() => toggleFlag(question.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                flagged.has(question.id)
                  ? "bg-yellow-100 text-yellow-700"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              <Bookmark className={cn("h-4 w-4", flagged.has(question.id) && "fill-yellow-500")} />
              {flagged.has(question.id) ? "Flagged" : "Flag for Review"}
            </button>
          </div>

          {/* Question Text */}
          <h2 className="mt-5 text-xl font-medium text-gray-900 leading-relaxed">
            {question.question_text}
          </h2>

          {/* Answer area — varies by question type */}
          <div className="mt-6 space-y-3">
            {question.question_type === "essay" ? (
              <textarea
                value={(answers[question.id] as string) ?? ""}
                onChange={(e) => selectAnswer(question.id, e.target.value)}
                rows={6}
                placeholder="Type your answer…"
                className="w-full rounded-lg border-2 border-gray-200 p-4 text-sm focus:border-primary-500 focus:outline-none"
              />
            ) : question.question_type === "fill_blank" ? (
              <input
                type="text"
                value={(answers[question.id] as string) ?? ""}
                onChange={(e) => selectAnswer(question.id, e.target.value)}
                placeholder="Type your answer…"
                className="w-full rounded-lg border-2 border-gray-200 p-4 text-sm focus:border-primary-500 focus:outline-none"
              />
            ) : (
              question.options.map((option, idx) => {
                const isMulti = question.question_type === "multi_select";
                const cur = answers[question.id];
                const isSelected = isMulti
                  ? Array.isArray(cur) && cur.includes(option.value)
                  : cur === option.value;
                return (
                  <label
                    key={idx}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-all",
                      isSelected
                        ? "border-primary-600 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      name={`q-${question.id}`}
                      checked={isSelected}
                      onChange={() =>
                        isMulti
                          ? toggleMultiAnswer(question.id, option.value)
                          : selectAnswer(question.id, option.value)
                      }
                      className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className={cn("text-sm", isSelected ? "font-medium text-primary-900" : "text-gray-700")}>
                      {option.value}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* ---- Question Number Pills ---- */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {questions.map((q, idx) => {
            const answered = isAnswered(q.id);
            const isFlagged = flagged.has(q.id);
            const isCurrent = idx === currentQuestion;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(idx)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all",
                  isCurrent && "ring-2 ring-primary-600 ring-offset-2",
                  isFlagged && !isCurrent
                    ? "bg-yellow-100 text-yellow-700"
                    : answered
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* ---- Bottom Navigation ---- */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestion((i) => Math.max(0, i - 1))}
            disabled={currentQuestion === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          {currentQuestion === questions.length - 1 ? (
            <Button variant="success" className="px-6" onClick={() => setShowSubmitModal(true)}>
              <CheckCircle2 className="h-4 w-4" />
              Submit Assessment
            </Button>
          ) : (
            <button
              onClick={() => setCurrentQuestion((i) => Math.min(questions.length - 1, i + 1))}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
