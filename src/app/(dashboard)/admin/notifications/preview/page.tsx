import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/auth/roles";
import PreviewClient from "./preview-client";

export const metadata: Metadata = {
  title: "Email Template Previews | LMS Platform",
  description: "Preview every transactional email template with sample data",
};

export default async function NotificationPreviewPage() {
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

  return <PreviewClient />;
}
