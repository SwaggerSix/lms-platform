import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import RatingsClient, { type Facet } from "./ratings-client";

export const metadata: Metadata = {
  title: "Ratings | LMS Platform",
  description: "Course and instructor five-star ratings, by class, client, and over time",
};

export default async function RatingsPage() {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await service
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!profile || !["admin", "super_admin", "instructor", "manager"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const [{ data: instructors }, { data: courses }, { data: classes }, { data: tenants }] = await Promise.all([
    service.from("users").select("id, first_name, last_name").in("role", ["instructor", "admin", "super_admin"]).order("first_name"),
    service.from("courses").select("id, title").order("title"),
    service.from("classes").select("id, title").order("title"),
    service.from("tenants").select("id, name").order("name"),
  ]);

  const instructorFacets: Facet[] = (instructors ?? []).map((i) => ({ id: i.id, label: `${i.first_name} ${i.last_name}` }));
  const courseFacets: Facet[] = (courses ?? []).map((c) => ({ id: c.id, label: c.title }));
  const classFacets: Facet[] = (classes ?? []).map((c) => ({ id: c.id, label: c.title }));
  const clientFacets: Facet[] = (tenants ?? []).map((t) => ({ id: t.id, label: t.name }));

  return (
    <RatingsClient
      instructors={instructorFacets}
      courses={courseFacets}
      classes={classFacets}
      clients={clientFacets}
    />
  );
}
