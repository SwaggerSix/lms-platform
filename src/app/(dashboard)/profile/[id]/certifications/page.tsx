import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect, notFound } from "next/navigation";
import CourseCertificationsClient from "./course-certifications-client";

export const metadata: Metadata = {
  title: "Gotham Course Certifications | LMS Platform",
  description: "Manage the gC and GGS courses a subcontractor is certified to deliver",
};

// Roles allowed to view/manage subcontractor course certifications:
// admins, super admins and (project) managers.
const STAFF = ["admin", "super_admin", "manager"];

export default async function SubcontractorCertificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: viewer } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!viewer) redirect("/login");

  // This is a hidden, staff-only page. Only admins/super admins and managers
  // may reach it; everyone else (including the subcontractor themselves) is
  // bounced to their dashboard.
  if (!STAFF.includes(viewer.role)) redirect("/dashboard");

  // The subcontractor whose certifications we're managing.
  const { data: subject } = await service
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("id", id)
    .single();
  if (!subject) notFound();

  // All published gC / GGS courses (the shared Gotham catalog).
  const { data: courses } = await service
    .from("courses")
    .select("id, title, short_description, category:categories(name)")
    .eq("status", "published")
    .order("title", { ascending: true });

  // Existing certifications for this subcontractor.
  const { data: certs } = await service
    .from("subcontractor_course_certifications")
    .select("course_id, certified_date")
    .eq("user_id", id);

  const courseList = (courses ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    shortDescription: c.short_description ?? null,
    category: Array.isArray(c.category)
      ? c.category[0]?.name ?? null
      : c.category?.name ?? null,
  }));

  const certMap: Record<string, string | null> = {};
  for (const row of certs ?? []) {
    certMap[(row as any).course_id] = (row as any).certified_date ?? null;
  }

  return (
    <CourseCertificationsClient
      subjectId={subject.id}
      subjectName={
        `${subject.first_name ?? ""} ${subject.last_name ?? ""}`.trim() ||
        subject.email
      }
      courses={courseList}
      initialCertifications={certMap}
    />
  );
}
