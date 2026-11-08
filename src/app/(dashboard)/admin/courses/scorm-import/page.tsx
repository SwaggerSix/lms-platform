import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ScormImportClient from "./scorm-import-client";

export const metadata: Metadata = {
  title: "Import SCORM Course | LMS Platform",
  description: "Create a course from a SCORM package",
};

export default async function ScormImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service.from("users").select("role").eq("auth_id", user.id).single();
  if (!dbUser || !["admin", "super_admin", "instructor"].includes(dbUser.role)) redirect("/dashboard");

  return <ScormImportClient />;
}
