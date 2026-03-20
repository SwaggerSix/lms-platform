import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CycleDetailClient from "./cycle-detail-client";

export const metadata: Metadata = {
  title: "Feedback Cycle Details | LMS Platform",
  description: "Manage nominations and view progress for a feedback cycle",
};

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || !["admin", "manager"].includes(dbUser.role)) redirect("/dashboard");

  // Fetch cycle with related data
  const { data: cycle } = await service
    .from("feedback_cycles")
    .select(`
      *,
      creator:users!feedback_cycles_created_by_fkey(id, first_name, last_name),
      templates:feedback_templates(*),
      nominations:feedback_nominations(
        *,
        subject:users!feedback_nominations_subject_id_fkey(id, first_name, last_name, email),
        reviewer:users!feedback_nominations_reviewer_id_fkey(id, first_name, last_name, email),
        responses:feedback_responses(id, is_draft, submitted_at)
      )
    `)
    .eq("id", id)
    .single();

  if (!cycle) redirect("/admin/feedback");

  // Fetch available users for nominations
  const { data: users } = await service
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("status", "active")
    .order("first_name");

  // Fetch competencies
  const { data: competencies } = await service
    .from("feedback_competencies")
    .select("*")
    .eq("is_active", true)
    .order("category");

  return (
    <CycleDetailClient
      cycle={cycle}
      users={users || []}
      competencies={competencies || []}
    />
  );
}
