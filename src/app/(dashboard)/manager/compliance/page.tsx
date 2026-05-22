import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeRecertExpiry, getRequiredCourseSources } from "@/lib/courses/required-training";
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
  HIPAA: "bg-pink-100 text-pink-700",
  Corporate: "bg-teal-100 text-teal-700",
};

interface ReqSource {
  id: string;
  name: string;
  regulation: string;
  courseId: string;
  frequencyMonths: number | null;
  /** Reference date for the "next due" calculation when no completion exists. */
  createdAt: Date;
}

export default async function CompliancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: currentUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!currentUser) redirect("/login");

  const { data: teamMembers } = await service
    .from("users")
    .select("id, first_name, last_name, role, organization_id, hire_date")
    .eq("manager_id", currentUser.id)
    .eq("status", "active");

  const members = teamMembers ?? [];
  const memberIds = members.map((m: any) => m.id);

  // Canonical source: courses.metadata.required_for. The manager compliance
  // view is specifically about MANDATORY compliance, so non-mandatory
  // required-training is filtered out.
  const rawSources = await getRequiredCourseSources(service);
  const sources: ReqSource[] = rawSources
    .filter((s) => s.mandatory)
    .map((s) => ({
      id: s.id,
      name: s.name,
      regulation: s.regulation || "Other",
      courseId: s.courseId,
      frequencyMonths: s.frequencyMonths,
      createdAt: s.createdAt,
    }));

  // Pull enrollments + lesson progress for the team across all involved courses.
  const courseIds = Array.from(new Set(sources.map((s) => s.courseId)));

  const { data: allEnrollments } = courseIds.length > 0 && memberIds.length > 0
    ? await service
        .from("enrollments")
        .select("id, user_id, course_id, status, completed_at, due_date")
        .in("user_id", memberIds)
        .in("course_id", courseIds)
    : { data: [] as any[] };

  const enrollments = (allEnrollments ?? []) as any[];

  const inProgressEnrollmentIds = enrollments
    .filter((e) => e.status === "in_progress")
    .map((e) => e.id);

  const lessonProgressMap: Record<string, { completed: number; total: number }> = {};
  if (inProgressEnrollmentIds.length > 0) {
    const { data: lpRows } = await service
      .from("lesson_progress")
      .select("enrollment_id, status")
      .in("enrollment_id", inProgressEnrollmentIds);
    for (const lp of lpRows ?? []) {
      const slot = lessonProgressMap[lp.enrollment_id] ?? { completed: 0, total: 0 };
      slot.total += 1;
      if (lp.status === "completed") slot.completed += 1;
      lessonProgressMap[lp.enrollment_id] = slot;
    }
  }

  // For each (user, course) keep the latest enrollment so re-enrolls (driven
  // by compliance-recurrence cron) don't confuse the status calc.
  const enrollmentLookup: Record<string, any> = {};
  for (const e of enrollments) {
    const key = `${e.user_id}_${e.course_id}`;
    const prev = enrollmentLookup[key];
    if (!prev) {
      enrollmentLookup[key] = e;
      continue;
    }
    // Prefer the most recently completed or most recent enrollment by id (uuid
    // ordering isn't perfect, but completed_at + status gives us a good signal).
    const prevWeight = prev.status === "completed" ? new Date(prev.completed_at ?? 0).getTime() : 1;
    const curWeight = e.status === "completed" ? new Date(e.completed_at ?? 0).getTime() : 1;
    if (curWeight >= prevWeight) enrollmentLookup[key] = e;
  }

  const now = new Date();

  const requirements: ComplianceRequirement[] = sources.map((source) => {
    // Deadline calculation:
    //   - If frequencyMonths is set, deadline = createdAt + frequencyMonths
    //     (or completedAt + frequencyMonths per-member, computed below).
    //   - If no frequency, fall back to createdAt + 12 months as a default.
    const sharedDeadline = computeRecertExpiry(source.createdAt, source.frequencyMonths ?? 12);

    const memberCompliance: MemberCompliance[] = members.map((member: any) => {
      const firstName = member.first_name ?? "";
      const lastName = member.last_name ?? "";
      const name = `${firstName} ${lastName}`.trim();
      const avatar = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "??";

      const enrollment = source.courseId
        ? enrollmentLookup[`${member.id}_${source.courseId}`]
        : null;

      let status: MemberCompliance["status"] = "not-started";
      let completedDate: string | null = null;
      let progress = 0;

      if (enrollment) {
        if (enrollment.status === "completed") {
          progress = 100;
          completedDate = enrollment.completed_at
            ? new Date(enrollment.completed_at).toISOString().split("T")[0]
            : null;
          // For recurring requirements, check if the completion has aged past
          // the recurrence window — if so, treat as overdue (cron will catch
          // up but the manager should see the gap immediately).
          if (source.frequencyMonths && enrollment.completed_at) {
            const expiresAt = computeRecertExpiry(enrollment.completed_at, source.frequencyMonths);
            status = expiresAt < now ? "overdue" : "completed";
          } else {
            status = "completed";
          }
        } else if (enrollment.status === "in_progress" || enrollment.status === "enrolled") {
          const dueDate = enrollment.due_date ? new Date(enrollment.due_date) : sharedDeadline;
          if (now > dueDate) {
            status = "overdue";
          } else if (enrollment.status === "in_progress") {
            status = "in-progress";
          } else {
            status = "not-started";
          }
          const lp = lessonProgressMap[enrollment.id];
          if (lp && lp.total > 0) progress = Math.round((lp.completed / lp.total) * 100);
        } else if (enrollment.status === "expired" || enrollment.status === "failed") {
          status = "overdue";
          const lp = lessonProgressMap[enrollment.id];
          if (lp && lp.total > 0) progress = Math.round((lp.completed / lp.total) * 100);
        }
      }

      return { id: member.id, name, avatar, status, completedDate, progress };
    });

    const completedCount = memberCompliance.filter((m) => m.status === "completed").length;
    const regulation = source.regulation || "Other";
    const regulationColor = regulationColorMap[regulation] ?? "bg-gray-100 text-gray-700";

    return {
      id: source.id,
      name: source.name,
      regulation,
      regulationColor,
      deadline: sharedDeadline.toISOString().split("T")[0],
      completedCount,
      totalCount: members.length,
      members: memberCompliance,
    };
  });

  // Expiring alerts: any (member × requirement) whose effective deadline is
  // within 30 days and not yet completed-and-current.
  const expiringAlertMap: Record<string, ExpiringAlert> = {};
  for (const source of sources) {
    const sharedDeadline = computeRecertExpiry(source.createdAt, source.frequencyMonths ?? 12);

    let membersRemaining = 0;
    let nearestDays = Number.POSITIVE_INFINITY;

    for (const member of members) {
      const enrollment = source.courseId
        ? enrollmentLookup[`${member.id}_${source.courseId}`]
        : null;
      let effectiveDeadline = sharedDeadline;
      let alreadyCovered = false;

      if (enrollment?.status === "completed" && enrollment.completed_at) {
        if (source.frequencyMonths) {
          const expiresAt = computeRecertExpiry(enrollment.completed_at, source.frequencyMonths);
          effectiveDeadline = expiresAt;
          alreadyCovered = expiresAt >= now;
        } else {
          alreadyCovered = true;
        }
      } else if (enrollment?.due_date) {
        effectiveDeadline = new Date(enrollment.due_date);
      }

      if (alreadyCovered) {
        // Only count as "expiring" if within the 30-day renewal window.
        const daysLeft = Math.ceil(
          (effectiveDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft > 0 && daysLeft <= 30) {
          membersRemaining += 1;
          if (daysLeft < nearestDays) nearestDays = daysLeft;
        }
        continue;
      }

      const daysLeft = Math.ceil(
        (effectiveDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft > 0 && daysLeft <= 30) {
        membersRemaining += 1;
        if (daysLeft < nearestDays) nearestDays = daysLeft;
      }
    }

    if (membersRemaining > 0 && Number.isFinite(nearestDays)) {
      expiringAlertMap[source.id] = {
        requirement: `${source.name} (${source.regulation})`,
        daysLeft: nearestDays,
        membersRemaining,
      };
    }
  }

  const expiringAlerts = Object.values(expiringAlertMap).sort((a, b) => a.daysLeft - b.daysLeft);

  return <ComplianceClient requirements={requirements} expiringAlerts={expiringAlerts} />;
}
