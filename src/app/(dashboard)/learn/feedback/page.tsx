import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import LearnerFeedbackClient from "./learner-feedback-client";

export const metadata: Metadata = {
  title: "My Feedback | LMS Platform",
  description: "View pending reviews and your feedback reports",
};

export default async function LearnerFeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, first_name, last_name")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  // Get nominations where user is the reviewer (pending reviews)
  const { data: pendingReviews } = await service
    .from("feedback_nominations")
    .select(`
      *,
      cycle:feedback_cycles(id, name, status, anonymous, end_date),
      subject:users!feedback_nominations_subject_id_fkey(id, first_name, last_name),
      responses:feedback_responses(id, is_draft, submitted_at)
    `)
    .eq("reviewer_id", dbUser.id)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false });

  // Get cycles where user is a subject (my feedback reports)
  const { data: myNominations } = await service
    .from("feedback_nominations")
    .select(`
      cycle_id,
      status,
      cycle:feedback_cycles(id, name, status, cycle_type)
    `)
    .eq("subject_id", dbUser.id);

  // Aggregate: unique cycles where user is a subject
  const myCyclesMap = new Map<string, { cycle: any; total: number; completed: number }>();
  for (const nom of (myNominations || [])) {
    const cid = nom.cycle_id;
    if (!myCyclesMap.has(cid)) {
      myCyclesMap.set(cid, { cycle: nom.cycle, total: 0, completed: 0 });
    }
    const entry = myCyclesMap.get(cid)!;
    entry.total++;
    if (nom.status === "completed") entry.completed++;
  }

  return (
    <LearnerFeedbackClient
      userId={dbUser.id}
      userName={`${dbUser.first_name} ${dbUser.last_name}`}
      pendingReviews={(pendingReviews || []).filter((r: any) => r.cycle?.status === "active")}
      myCycles={Array.from(myCyclesMap.values())}
    />
  );
}
