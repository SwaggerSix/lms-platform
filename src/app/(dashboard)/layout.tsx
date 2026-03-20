import AppShell from "@/components/layout/app-shell";
import { AuthProvider } from "@/components/providers/auth-provider";
import InstallPrompt from "@/components/pwa/install-prompt";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
      <InstallPrompt />
    </AuthProvider>
  );
}
