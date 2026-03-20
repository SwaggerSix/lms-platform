import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import FeedbackFormPage from "./feedback-form-page";

export const metadata: Metadata = {
  title: "Submit Feedback | LMS Platform",
  description: "Complete a feedback review",
};

export default async function NominationFeedbackPage({
  params,
}: {
  params: Promise<{ nominationId: string }>;
}) {
  const { nominationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  // Get nomination with related data
  const { data: nomination } = await service
    .from("feedback_nominations")
    .select(`
      *,
      cycle:feedback_cycles(*, templates:feedback_templates(*)),
      subject:users!feedback_nominations_subject_id_fkey(id, first_name, last_name),
      reviewer:users!feedback_nominations_reviewer_id_fkey(id, first_name, last_name),
      responses:feedback_responses(*)
    `)
    .eq("id", nominationId)
    .single();

  if (!nomination) redirect("/learn/feedback");

  // Verify user is the reviewer
  if (nomination.reviewer_id !== dbUser.id) redirect("/learn/feedback");

  // Check if already submitted
  if (nomination.status === "completed") redirect("/learn/feedback");

  // Get template questions
  const templates = (nomination.cycle as any)?.templates || [];
  const questions = templates.length > 0 ? templates[0].questions : getDefaultQuestions();

  // Get existing draft
  const existingResponse = (nomination.responses || []).find((r: any) => r.is_draft);

  const subjectName = (nomination.cycle as any)?.anonymous
    ? "Anonymous Subject"
    : `${(nomination.subject as any)?.first_name} ${(nomination.subject as any)?.last_name}`;

  return (
    <FeedbackFormPage
      nominationId={nominationId}
      questions={questions}
      initialAnswers={existingResponse?.answers || {}}
      existingResponseId={existingResponse?.id || null}
      subjectName={subjectName}
      relationship={nomination.relationship}
      cycleName={(nomination.cycle as any)?.name || "Feedback"}
    />
  );
}

function getDefaultQuestions() {
  return [
    {
      id: "q1",
      text: "How would you rate this person's overall performance?",
      type: "rating",
      required: true,
    },
    {
      id: "q2",
      text: "How effectively does this person communicate with others?",
      type: "rating",
      required: true,
    },
    {
      id: "q3",
      text: "How well does this person collaborate within their team?",
      type: "rating",
      required: true,
    },
    {
      id: "q4",
      text: "How would you rate this person's leadership qualities?",
      type: "rating",
      required: true,
    },
    {
      id: "q5",
      text: "What are this person's greatest strengths?",
      type: "text",
      required: true,
    },
    {
      id: "q6",
      text: "What areas could this person improve in?",
      type: "text",
      required: true,
    },
    {
      id: "q7",
      text: "Any additional comments or feedback?",
      type: "text",
      required: false,
    },
  ];
}
