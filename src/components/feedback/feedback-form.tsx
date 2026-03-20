"use client";

import { useState, useCallback } from "react";

interface Question {
  id: string;
  text: string;
  type: "rating" | "text" | "competency" | "multiple_choice";
  required: boolean;
  options?: string[];
  competency_id?: string;
}

interface FeedbackFormProps {
  questions: Question[];
  initialAnswers?: Record<string, any>;
  nominationId: string;
  subjectName: string;
  relationship: string;
  onSaveDraft: (answers: Record<string, any>) => Promise<void>;
  onSubmit: (answers: Record<string, any>) => Promise<void>;
  isSubmitting?: boolean;
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-colors disabled:cursor-not-allowed"
        >
          <svg
            className={`w-8 h-8 ${
              star <= (hover || value)
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300 fill-gray-300"
            } transition-colors`}
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
      <span className="ml-2 text-sm text-gray-500">
        {value > 0 ? `${value}/5` : "Not rated"}
      </span>
    </div>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: "Needs Significant Improvement",
  2: "Below Expectations",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};

export default function FeedbackForm({
  questions,
  initialAnswers = {},
  nominationId,
  subjectName,
  relationship,
  onSaveDraft,
  onSubmit,
  isSubmitting = false,
}: FeedbackFormProps) {
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const updateAnswer = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await onSaveDraft(answers);
      setLastSaved(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const missing = questions.filter(
      (q) => q.required && (answers[q.id] === undefined || answers[q.id] === "" || answers[q.id] === 0)
    );
    if (missing.length > 0) {
      alert(`Please complete all required fields: ${missing.map((q) => q.text).join(", ")}`);
      return;
    }

    await onSubmit(answers);
  };

  const relationshipLabel: Record<string, string> = {
    self: "Self Assessment",
    peer: "Peer Review",
    manager: "Manager Review",
    direct_report: "Direct Report Review",
    external: "External Review",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-xl font-semibold">Feedback for {subjectName}</h2>
        <p className="text-indigo-100 mt-1">
          {relationshipLabel[relationship] || relationship}
        </p>
        <p className="text-indigo-200 text-sm mt-2">
          Your honest and constructive feedback helps growth and development.
          {relationship !== "self" && " Responses may be anonymized."}
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => (
          <div
            key={question.id}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-gray-900">
                  {question.text}
                  {question.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </p>
              </div>
            </div>

            {/* Rating */}
            {question.type === "rating" && (
              <div className="ml-11">
                <StarRating
                  value={answers[question.id] || 0}
                  onChange={(v) => updateAnswer(question.id, v)}
                  disabled={isSubmitting}
                />
                {answers[question.id] > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {RATING_LABELS[answers[question.id]]}
                  </p>
                )}
              </div>
            )}

            {/* Competency Rating */}
            {question.type === "competency" && (
              <div className="ml-11">
                <StarRating
                  value={
                    typeof answers[question.id] === "object"
                      ? answers[question.id]?.score || 0
                      : answers[question.id] || 0
                  }
                  onChange={(v) =>
                    updateAnswer(question.id, {
                      competency: question.competency_id,
                      name: question.text,
                      score: v,
                    })
                  }
                  disabled={isSubmitting}
                />
                {(typeof answers[question.id] === "object"
                  ? answers[question.id]?.score
                  : answers[question.id]) > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {
                      RATING_LABELS[
                        typeof answers[question.id] === "object"
                          ? answers[question.id]?.score
                          : answers[question.id]
                      ]
                    }
                  </p>
                )}
              </div>
            )}

            {/* Text */}
            {question.type === "text" && (
              <div className="ml-11">
                <textarea
                  value={answers[question.id] || ""}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                  placeholder="Share your feedback..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {/* Multiple Choice */}
            {question.type === "multiple_choice" && question.options && (
              <div className="ml-11 space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={() => updateAnswer(question.id, option)}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="text-sm text-gray-500">
          {lastSaved && (
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Draft saved at {lastSaved}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </div>
    </form>
  );
}
