"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FeedbackForm from "@/components/feedback/feedback-form";

interface FeedbackFormPageProps {
  nominationId: string;
  questions: any[];
  initialAnswers: Record<string, any>;
  existingResponseId: string | null;
  subjectName: string;
  relationship: string;
  cycleName: string;
}

export default function FeedbackFormPage({
  nominationId,
  questions,
  initialAnswers,
  existingResponseId,
  subjectName,
  relationship,
  cycleName,
}: FeedbackFormPageProps) {
  const router = useRouter();
  const [responseId, setResponseId] = useState<string | null>(existingResponseId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveDraft = useCallback(
    async (answers: Record<string, any>) => {
      if (responseId) {
        await fetch("/api/feedback/responses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: responseId,
            answers,
            is_draft: true,
          }),
        });
      } else {
        const res = await fetch("/api/feedback/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nomination_id: nominationId,
            answers,
            is_draft: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setResponseId(data.id);
        }
      }
    },
    [nominationId, responseId]
  );

  const handleSubmit = useCallback(
    async (answers: Record<string, any>) => {
      setIsSubmitting(true);
      try {
        if (responseId) {
          const res = await fetch("/api/feedback/responses", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: responseId,
              answers,
              is_draft: false,
            }),
          });
          if (res.ok) router.push("/learn/feedback");
        } else {
          const res = await fetch("/api/feedback/responses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nomination_id: nominationId,
              answers,
              is_draft: false,
            }),
          });
          if (res.ok) router.push("/learn/feedback");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [nominationId, responseId, router]
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/learn/feedback")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to My Feedback
      </button>

      <div className="text-sm text-gray-500">{cycleName}</div>

      <FeedbackForm
        questions={questions}
        initialAnswers={initialAnswers}
        nominationId={nominationId}
        subjectName={subjectName}
        relationship={relationship}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
