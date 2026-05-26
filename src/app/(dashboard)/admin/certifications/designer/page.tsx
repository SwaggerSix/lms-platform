import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/auth/roles";
import DesignerClient from "./designer-client";

export default async function CertificateDesignerPage() {
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
    redirect("/dashboard");
  }

  // Fetch existing templates
  const { data: templates } = await service
    .from("certificate_templates")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return <DesignerClient templates={templates || []} />;
}
