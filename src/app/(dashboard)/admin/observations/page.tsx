import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ObservationsAdminClient from "./observations-admin-client";

export const metadata: Metadata = {
  title: "Observations | LMS Platform",
  description: "Manage observation templates and scheduled observations",
};

export default async function ObservationsAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || !["admin", "manager", "instructor"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  const [templatesRes, observationsRes] = await Promise.all([
    service.from("observation_templates").select("*").order("created_at", { ascending: false }),
    service
      .from("observations")
      .select(`
        *,
        template:observation_templates(id, name, category),
        observer:users!observations_observer_id_fkey(id, first_name, last_name),
        subject:users!observations_subject_id_fkey(id, first_name, last_name)
      `)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <ObservationsAdminClient
      initialTemplates={templatesRes.data || []}
      initialObservations={observationsRes.data || []}
    />
  );
}
