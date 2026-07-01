import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect, notFound } from "next/navigation";
import ProfileClient from "../profile-client";
import { buildProfileData } from "../get-profile-data";

export const metadata: Metadata = {
  title: "Profile | LMS Platform",
  description: "View a team member's profile, skills, and certifications",
};

export default async function MemberProfilePage({
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

  // Viewing your own profile → use the editable profile page.
  if (viewer.id === id) redirect("/profile");

  // Authorization: admins see anyone; managers see only their own reports.
  const isAdmin = ["admin", "super_admin"].includes(viewer.role);
  if (!isAdmin) {
    if (viewer.role !== "manager") redirect("/dashboard");
    const { data: target } = await service
      .from("users")
      .select("manager_id")
      .eq("id", id)
      .single();
    if (!target || target.manager_id !== viewer.id) {
      redirect("/dashboard");
    }
  }

  const profileData = await buildProfileData(id);
  if (!profileData) notFound();

  // Everyone who reaches this render is an admin/super_admin or a manager of
  // this user — all roles permitted to manage course certifications — so expose
  // the hidden Gotham Course Certifications page to them.
  const canManageCertifications =
    isAdmin || viewer.role === "manager" || viewer.role === "super_admin";

  return (
    <ProfileClient
      data={profileData}
      readOnly
      certificationsHref={
        canManageCertifications ? `/profile/${id}/certifications` : undefined
      }
    />
  );
}
