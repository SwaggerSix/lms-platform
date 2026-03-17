import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ApprovalsClient from "./approvals-client";
import type { ApprovalRequest } from "./approvals-client";

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase() || "??";
}

export default async function AdminApprovalsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  const { data: rows } = await supabase
    .from("enrollment_approvals")
    .select(
      "*, course:courses!course_id(id, title, category:categories!category_id(name)), learner:users!learner_id(id, first_name, last_name, email, organization_id, manager_id, organization:organizations!organization_id(name)), approver:users!approver_id(id, first_name, last_name)"
    )
    .order("requested_at", { ascending: false });

  // Build a set of manager IDs so we can look up their names
  const managerIds = new Set<string>();
  for (const row of rows ?? []) {
    const learner = (row as any).learner;
    if (learner?.manager_id) {
      managerIds.add(learner.manager_id);
    }
  }

  // Fetch manager names in a single query
  let managerMap: Record<string, string> = {};
  if (managerIds.size > 0) {
    const { data: managers } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .in("id", Array.from(managerIds));

    for (const m of managers ?? []) {
      managerMap[m.id] = `${m.first_name} ${m.last_name}`.trim();
    }
  }

  const approvals: ApprovalRequest[] = (rows ?? []).map((row: any) => {
    const learner = row.learner as any;
    const course = row.course as any;

    const firstName = learner?.first_name ?? "";
    const lastName = learner?.last_name ?? "";
    const learnerName = `${firstName} ${lastName}`.trim() || "Unknown Learner";

    const managerName = learner?.manager_id
      ? managerMap[learner.manager_id] ?? "Unknown Manager"
      : "No Manager";

    return {
      id: row.id,
      learnerName,
      learnerInitials: getInitials(firstName, lastName),
      learnerEmail: learner?.email ?? "",
      department: learner?.organization?.name ?? "Unassigned",
      managerName,
      courseTitle: course?.title ?? "Unknown Course",
      courseCategory: course?.category?.name ?? "General",
      requestDate: row.requested_at ?? row.created_at,
      decidedAt: row.decided_at ?? null,
      status: row.status ?? "pending",
      reason: row.reason ?? "",
      rejectionReason: row.rejection_reason ?? null,
    };
  });

  return <ApprovalsClient approvals={approvals} />;
}
