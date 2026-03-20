import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import NewTemplateClient from "./new-template-client";

export const metadata: Metadata = {
  title: "New Observation Template | LMS Platform",
  description: "Create a new observation checklist template",
};

export default async function NewTemplatePage() {
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

  return <NewTemplateClient />;
}
