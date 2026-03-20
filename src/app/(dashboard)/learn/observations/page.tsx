import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import MyObservationsClient from "./my-observations-client";

export const metadata: Metadata = {
  title: "My Observations | LMS Platform",
  description: "View observations you've conducted and been a subject of",
};

export default async function MyObservationsPage() {
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

  // Fetch observations where user is observer
  const { data: asObserver } = await service
    .from("observations")
    .select(`
      *,
      template:observation_templates(id, name, category),
      subject:users!observations_subject_id_fkey(id, first_name, last_name)
    `)
    .eq("observer_id", dbUser.id)
    .order("created_at", { ascending: false });

  // Fetch observations where user is subject
  const { data: asSubject } = await service
    .from("observations")
    .select(`
      *,
      template:observation_templates(id, name, category),
      observer:users!observations_observer_id_fkey(id, first_name, last_name)
    `)
    .eq("subject_id", dbUser.id)
    .order("created_at", { ascending: false });

  // Fetch active templates for creating new observations (if observer role)
  const canObserve = ["admin", "manager", "instructor"].includes(dbUser.role);
  let templates: any[] = [];
  if (canObserve) {
    const { data } = await service
      .from("observation_templates")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name");
    templates = data || [];
  }

  return (
    <MyObservationsClient
      asObserver={asObserver || []}
      asSubject={asSubject || []}
      templates={templates}
      canObserve={canObserve}
      userId={dbUser.id}
    />
  );
}
