import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateReport } from "@/lib/reports/generate";
import TrainingMatrixClient, { type MatrixRow } from "./matrix-client";

export const metadata: Metadata = {
  title: "Training Matrix | LMS Platform",
  description:
    "People × required training grid with compliance RAG status per cell",
};

export default async function TrainingMatrixPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) redirect("/login");
  if (!["admin", "super_admin", "manager"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  const rows = (await generateReport("training_matrix")) as unknown as MatrixRow[];

  return <TrainingMatrixClient rows={rows} />;
}
