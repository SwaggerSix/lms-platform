import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ApprovalsClient, { type ApprovalRequest } from "./approvals-client";

export const metadata: Metadata = {
  title: "Approvals | LMS Platform",
  description: "Review and manage enrollment approval requests from your team",
};

export default async function ManagerApprovalsPage() {
  const supabase = await createClient();

  // Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up internal user by auth_id
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch approval requests where current user is the approver, with course and learner joins
  const { data: rawApprovals } = await service
    .from("enrollment_approvals")
    .select(
      "id, status, requested_at, decided_at, reason, rejection_reason, course:courses(id, title, category:categories(name)), learner:users!enrollment_approvals_learner_id_fkey(id, first_name, last_name, email)"
    )
    .eq("approver_id", dbUser.id)
    .order("requested_at", { ascending: false });

  // Map database rows to the ApprovalRequest interface expected by the client
  const approvals: ApprovalRequest[] = (rawApprovals ?? []).map((row: any) => {
    const firstName = row.learner?.first_name ?? "";
    const lastName = row.learner?.last_name ?? "";
    const learnerName = `${firstName} ${lastName}`.trim() || "Unknown";
    const learnerInitials =
      ((firstName.charAt(0) ?? "") + (lastName.charAt(0) ?? "")).toUpperCase() || "??";

    return {
      id: row.id,
      learnerName,
      learnerInitials,
      learnerEmail: row.learner?.email ?? "",
      courseTitle: row.course?.title ?? "Unknown Course",
      courseCategory: row.course?.category?.name ?? "Uncategorized",
      requestDate: row.requested_at ?? "",
      decidedAt: row.decided_at ?? null,
      status: row.status,
      reason: row.reason ?? "",
      rejectionReason: row.rejection_reason ?? null,
    };
  });

  return <ApprovalsClient initialApprovals={approvals} />;
}
