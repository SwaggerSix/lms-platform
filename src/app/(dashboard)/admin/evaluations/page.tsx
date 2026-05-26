import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import EvaluationsAdminClient, {
  type Template,
  type Trigger,
  type Course,
} from "./evaluations-admin-client";

export const metadata: Metadata = {
  title: "Training Evaluations | LMS Platform",
  description: "Manage evaluation templates and course survey triggers",
};

export default async function EvaluationsAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || !isAdmin(dbUser.role)) {
    redirect("/learn/dashboard");
  }

  const [{ data: templates }, { data: triggers }, { data: courses }] = await Promise.all([
    service
      .from("evaluation_templates")
      .select("id, name, description, level, is_active, created_at")
      .order("created_at", { ascending: false }),
    service
      .from("evaluation_triggers")
      .select(`
        id, delay_days, is_active, created_at,
        course:courses(id, title),
        template:evaluation_templates(id, name, level)
      `)
      .order("created_at", { ascending: false }),
    service
      .from("courses")
      .select("id, title")
      .eq("status", "published")
      .order("title", { ascending: true }),
  ]);

  // Supabase service client returns loosely-typed rows (no generated
  // Database types), and the trigger query's nested joins don't line
  // up structurally with the flat client types — assert the shapes
  // explicitly at the boundary rather than laundering through `any`.
  return (
    <EvaluationsAdminClient
      templates={(templates ?? []) as unknown as Template[]}
      triggers={(triggers ?? []) as unknown as Trigger[]}
      courses={(courses ?? []) as unknown as Course[]}
    />
  );
}
