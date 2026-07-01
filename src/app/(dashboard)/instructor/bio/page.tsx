import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import BioClient from "./bio-client";

export const metadata: Metadata = {
  title: "My Bio | LMS Platform",
  description: "Create and manage your instructor bio",
};

export default async function InstructorBioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role, first_name, last_name, bio, preferences, external_source")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");
  if (!["instructor", "admin", "super_admin"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  const prefs = (dbUser.preferences as { bio?: string } | null) ?? {};
  const initialBio = dbUser.bio ?? prefs.bio ?? "";

  return (
    <BioClient
      initialBio={initialBio}
      name={`${dbUser.first_name ?? ""} ${dbUser.last_name ?? ""}`.trim()}
      portalSynced={dbUser.external_source === "partner_portal"}
    />
  );
}
