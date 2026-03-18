import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import AssignmentsClient from "./assignments-client";
import type { Assignment, Course, TeamMemberOption } from "./assignments-client";
import { formatDuration } from "@/utils/format";

export const metadata: Metadata = {
  title: "Assignments | LMS Platform",
  description: "Assign courses to team members and track their completion",
};

const COURSE_TYPE_LABELS: Record<string, string> = {
  self_paced: "Self-Paced",
  instructor_led: "Instructor-Led",
  blended: "Blended",
  scorm: "SCORM",
  external: "External",
};

function calculateProgress(
  status: string,
  timeSpent: number | null,
  estimatedDuration: number | null
): number {
  if (status === "completed") return 100;
  if (status === "enrolled") return 0;
  if (status === "in_progress") {
    if (!timeSpent || !estimatedDuration || estimatedDuration === 0) return 0;
    const raw = Math.round((timeSpent / estimatedDuration) * 100);
    return Math.min(raw, 95);
  }
  if (!timeSpent || !estimatedDuration || estimatedDuration === 0) return 0;
  const raw = Math.round((timeSpent / estimatedDuration) * 100);
  return Math.min(raw, 95);
}

function deriveStatus(
  enrollmentStatus: string,
  dueDate: string | null
): "active" | "completed" | "overdue" {
  if (enrollmentStatus === "completed") return "completed";
  if (dueDate && new Date(dueDate) < new Date()) return "overdue";
  return "active";
}

function derivePriority(dueDate: string | null): "high" | "medium" | "low" {
  if (!dueDate) return "low";
  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilDue < 0) return "high"; // overdue
  if (daysUntilDue <= 14) return "high";
  if (daysUntilDue <= 30) return "medium";
  return "low";
}

function getInitials(firstName: string, lastName: string): string {
  return (
    (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "??"
  );
}

export default async function AssignmentsPage() {
  const supabase = await createClient();

  // Get the current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up the user in the users table via auth_id
  const service = createServiceClient();
  const { data: currentUser } = await service
    .from("users")
    .select("id, first_name, last_name")
    .eq("auth_id", user.id)
    .single();

  if (!currentUser) {
    redirect("/login");
  }

  // Fetch team members (users where manager_id = current user)
  const { data: teamMembersData } = await service
    .from("users")
    .select("id, first_name, last_name")
    .eq("manager_id", currentUser.id);

  const teamMemberIds = (teamMembersData ?? []).map((u: any) => u.id);

  // Fetch enrollments assigned by current user OR for team members
  // Use an OR filter: assigned_by = currentUser.id, or user_id in teamMemberIds
  const userIdsToQuery =
    teamMemberIds.length > 0 ? teamMemberIds : ["__none__"];

  const { data: enrollments } = await service
    .from("enrollments")
    .select(
      "*, course:courses(id, title, estimated_duration, course_type, category:categories(name)), user:users!user_id(id, first_name, last_name)"
    )
    .or(
      `assigned_by.eq.${currentUser.id},user_id.in.(${userIdsToQuery.join(",")})`
    )
    .order("enrolled_at", { ascending: false });

  // Map enrollments to Assignment interface
  const assignments: Assignment[] = (enrollments ?? []).map((row: any) => {
    const course = row.course;
    const assignedUser = row.user;
    const firstName = assignedUser?.first_name ?? "";
    const lastName = assignedUser?.last_name ?? "";
    const fullName = `${firstName} ${lastName}`.trim() || "Unknown User";
    const avatar = getInitials(firstName, lastName);
    const status = deriveStatus(row.status, row.due_date);

    return {
      id: row.id,
      courseName: course?.title ?? "Untitled Course",
      assignedTo: fullName,
      assignedToAvatar: avatar,
      assignedDate: row.enrolled_at,
      dueDate: row.due_date ?? "",
      status,
      progress: calculateProgress(
        row.status,
        row.time_spent,
        course?.estimated_duration ?? null
      ),
      priority: derivePriority(row.due_date),
    };
  });

  // Fetch published courses for the assignment modal
  const { data: coursesData } = await service
    .from("courses")
    .select("id, title, estimated_duration, course_type, category:categories(name)")
    .eq("status", "published")
    .order("title", { ascending: true });

  const courses: Course[] = (coursesData ?? []).map((c: any) => ({
    id: c.id,
    name: c.title ?? "Untitled Course",
    duration: formatDuration(c.estimated_duration),
    category: c.category?.name ?? COURSE_TYPE_LABELS[c.course_type] ?? "General",
  }));

  // Map team members for the modal
  const teamMembers: TeamMemberOption[] = (teamMembersData ?? []).map(
    (u: any) => ({
      id: u.id,
      name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Unknown",
    })
  );

  return (
    <AssignmentsClient
      assignments={assignments}
      courses={courses}
      teamMembers={teamMembers}
    />
  );
}
