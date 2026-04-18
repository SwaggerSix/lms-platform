import { redirect } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import { AuthProvider } from "@/components/providers/auth-provider";
import InstallPrompt from "@/components/pwa/install-prompt";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const service = createServiceClient();
    const { data: profile } = await service
      .from("users")
      .select("preferences")
      .eq("auth_id", user.id)
      .single();

    if ((profile?.preferences as { must_change_password?: boolean } | null)?.must_change_password) {
      redirect("/welcome");
    }
  }

  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
      <InstallPrompt />
    </AuthProvider>
  );
}
