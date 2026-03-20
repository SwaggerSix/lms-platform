import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ObservationDetailClient from "./observation-detail-client";

export const metadata: Metadata = {
  title: "Observation | LMS Platform",
  description: "View or fill out an observation checklist",
};

export default async function ObservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (!dbUser) redirect("/login");

  const { data: observation, error } = await service
    .from("observations")
    .select(`
      *,
      template:observation_templates(id, name, description, category, items, passing_score),
      observer:users!observations_observer_id_fkey(id, first_name, last_name, email),
      subject:users!observations_subject_id_fkey(id, first_name, last_name, email),
      course:courses(id, title),
      sign_off_user:users!observations_sign_off_by_fkey(id, first_name, last_name),
      attachments:observation_attachments(id, file_url, file_name, file_type, created_at)
    `)
    .eq("id", id)
    .single();

  if (error || !observation) {
    redirect("/learn/observations");
  }

  // Check access
  const isAdmin = dbUser.role === "admin" || dbUser.role === "manager";
  const isObserver = observation.observer_id === dbUser.id;
  const isSubject = observation.subject_id === dbUser.id;

  if (!isAdmin && !isObserver && !isSubject) {
    redirect("/learn/observations");
  }

  return (
    <ObservationDetailClient
      observation={observation}
      currentUserId={dbUser.id}
      currentUserRole={dbUser.role}
      isObserver={isObserver}
      isSubject={isSubject}
    />
  );
}
