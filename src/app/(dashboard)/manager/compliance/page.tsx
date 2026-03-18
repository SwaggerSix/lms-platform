import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ComplianceClient, {
  type ComplianceRequirement,
  type MemberCompliance,
  type ExpiringAlert,
} from "./compliance-client";

export const metadata: Metadata = {
  title: "Compliance | LMS Platform",
  description: "Track mandatory training compliance status for your team",
};

const regulationColorMap: Record<string, string> = {
  OSHA: "bg-orange-100 text-orange-700",
  GDPR: "bg-blue-100 text-blue-700",
  HR: "bg-purple-100 text-purple-700",
  SOC2: "bg-red-100 text-red-700",
  Corporate: "bg-teal-100 text-teal-700",
};

export default async function CompliancePage() {
  const supabase = await createClient();

  // Get the current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up user in users table via auth_id
  const service = createServiceClient();
  const { data: currentUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!currentUser) {
    redirect("/login");
  }

  // Fetch team members (users where manager_id = current user's id)
  const { data: teamMembers } = await service
    .from("users")
    .select("id, first_name, last_name, role")
    .eq("manager_id", currentUser.id)
    .eq("status", "active");

  const members = teamMembers ?? [];
  const memberIds = members.map((m: any) => m.id);

  // Fetch all compliance requirements with their linked course
  const { data: complianceReqs } = await service
    .from("compliance_requirements")
    .select("*, course:courses(id, title)")
    .eq("is_mandatory", true)
    .order("created_at", { ascending: true });

  const reqs = (complianceReqs ?? []) as any[];

  // Fetch all enrollments for team members
  const { data: allEnrollments } = await service
    .from("enrollments")
    .select("id, user_id, course_id, status, completed_at, due_date")
    .in("user_id", memberIds.length > 0 ? memberIds : ["__none__"]);

  const enrollments = allEnrollments ?? [];

  // For enrollments that are in_progress, compute progress from lesson_progress
  const inProgressEnrollmentIds = enrollments
    .filter((e: any) => e.status === "in_progress")
    .map((e: any) => e.id);

  let lessonProgressMap: Record<string, { completed: number; total: number }> = {};

  if (inProgressEnrollmentIds.length > 0) {
    const { data: lessonProgressData } = await service
      .from("lesson_progress")
      .select("enrollment_id, status")
      .in("enrollment_id", inProgressEnrollmentIds);

    for (const lp of lessonProgressData ?? []) {
      if (!lessonProgressMap[lp.enrollment_id]) {
        lessonProgressMap[lp.enrollment_id] = { completed: 0, total: 0 };
      }
      lessonProgressMap[lp.enrollment_id].total += 1;
      if (lp.status === "completed") {
        lessonProgressMap[lp.enrollment_id].completed += 1;
      }
    }
  }

  // Build enrollment lookup: key = `${user_id}_${course_id}`
  const enrollmentLookup: Record<string, any> = {};
  for (const e of enrollments) {
    const key = `${(e as any).user_id}_${(e as any).course_id}`;
    enrollmentLookup[key] = e;
  }

  const now = new Date();

  // Build the ComplianceRequirement[] data structure
  const requirements: ComplianceRequirement[] = reqs.map((req) => {
    const courseId = req.course_id;

    // Compute a deadline: created_at + frequency_months
    const createdAt = new Date(req.created_at);
    const deadlineDate = new Date(createdAt);
    if (req.frequency_months) {
      deadlineDate.setMonth(deadlineDate.getMonth() + req.frequency_months);
    } else {
      // Default to 12 months from creation
      deadlineDate.setMonth(deadlineDate.getMonth() + 12);
    }
    const deadline = deadlineDate.toISOString().split("T")[0];

    // Build member compliance entries
    const memberCompliance: MemberCompliance[] = members.map((member: any) => {
      const firstName = member.first_name ?? "";
      const lastName = member.last_name ?? "";
      const name = `${firstName} ${lastName}`.trim();
      const avatar =
        (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "??";

      const enrollment = courseId
        ? enrollmentLookup[`${member.id}_${courseId}`]
        : null;

      let status: MemberCompliance["status"] = "not-started";
      let completedDate: string | null = null;
      let progress = 0;

      if (enrollment) {
        if (enrollment.status === "completed") {
          status = "completed";
          completedDate = enrollment.completed_at
            ? new Date(enrollment.completed_at).toISOString().split("T")[0]
            : null;
          progress = 100;
        } else if (
          enrollment.status === "in_progress" ||
          enrollment.status === "enrolled"
        ) {
          // Check if overdue (past due_date or past computed deadline)
          const dueDate = enrollment.due_date
            ? new Date(enrollment.due_date)
            : deadlineDate;
          if (now > dueDate) {
            status = "overdue";
          } else if (enrollment.status === "in_progress") {
            status = "in-progress";
          } else {
            // enrolled but not started
            status = "not-started";
          }

          // Compute progress from lesson_progress
          const lp = lessonProgressMap[enrollment.id];
          if (lp && lp.total > 0) {
            progress = Math.round((lp.completed / lp.total) * 100);
          }
        } else if (
          enrollment.status === "expired" ||
          enrollment.status === "failed"
        ) {
          status = "overdue";
          const lp = lessonProgressMap[enrollment.id];
          if (lp && lp.total > 0) {
            progress = Math.round((lp.completed / lp.total) * 100);
          }
        }
      }

      return {
        id: member.id,
        name,
        avatar,
        status,
        completedDate,
        progress,
      };
    });

    const completedCount = memberCompliance.filter(
      (m) => m.status === "completed"
    ).length;

    const regulation = req.regulation ?? "Other";
    const regulationColor =
      regulationColorMap[regulation] ?? "bg-gray-100 text-gray-700";

    return {
      id: req.id,
      name: req.name,
      regulation,
      regulationColor,
      deadline,
      completedCount,
      totalCount: members.length,
      members: memberCompliance,
    };
  });

  // Build expiring alerts: requirements with deadlines within 30 days that have incomplete members
  const expiringAlerts: ExpiringAlert[] = requirements
    .map((req) => {
      const daysLeft = Math.ceil(
        (new Date(req.deadline).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const membersRemaining = req.totalCount - req.completedCount;
      return {
        requirement: `${req.name} (${req.regulation})`,
        daysLeft,
        membersRemaining,
      };
    })
    .filter((a) => a.daysLeft > 0 && a.daysLeft <= 30 && a.membersRemaining > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <ComplianceClient
      requirements={requirements}
      expiringAlerts={expiringAlerts}
    />
  );
}
