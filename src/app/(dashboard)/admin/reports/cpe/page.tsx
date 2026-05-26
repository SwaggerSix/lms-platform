import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isManagerOrAbove } from "@/lib/auth/roles";
import CpeReportClient from "./cpe-report-client";
import type { CpeRow } from "./cpe-report-client";

export const metadata: Metadata = {
  title: "NASBA CPE Report | LMS Platform",
  description: "Track NASBA CPE credits earned by learners through course completions",
};

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; passing_only?: string }>;
}

export default async function CpeReportPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");
  if (!isManagerOrAbove(dbUser.role)) redirect("/dashboard");

  const params = await searchParams;
  const defaultFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultTo = new Date().toISOString().slice(0, 10);
  const from = params.from || defaultFrom;
  const to = params.to || defaultTo;
  // Default ON: only count enrollments that actually met the course's passing score.
  // NASBA requires a passing assessment to award CPE, so this matches the strict
  // interpretation by default and admins can flip it off to see every completion.
  const passingOnly = params.passing_only !== "false";

  const { data: cpeCourses } = await service
    .from("courses")
    .select("id, title, passing_score, metadata");

  const eligibleCourses = (cpeCourses ?? []).filter((c) => {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    return !!meta.nasba_cpe;
  });

  const creditsByCourse = new Map<string, { title: string; credits: number; version: string; passingScore: number }>();
  for (const c of eligibleCourses) {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    creditsByCourse.set(c.id, {
      title: c.title,
      credits: Number(meta.cpe_credits) || 0,
      version: (meta.course_version as string) || "",
      passingScore: Number(c.passing_score) || 0,
    });
  }

  const eligibleCourseIds = Array.from(creditsByCourse.keys());

  let rows: CpeRow[] = [];
  if (eligibleCourseIds.length > 0) {
    const { data: enrollments } = await service
      .from("enrollments")
      .select(`
        id, user_id, course_id, status, completed_at, score,
        user:users!enrollments_user_id_fkey(id, first_name, last_name, email, organization:organizations(name))
      `)
      .in("course_id", eligibleCourseIds)
      .eq("status", "completed")
      .gte("completed_at", `${from}T00:00:00.000Z`)
      .lte("completed_at", `${to}T23:59:59.999Z`)
      .order("completed_at", { ascending: false });

    type EnrollmentRow = {
      id: string;
      user_id: string;
      course_id: string;
      completed_at: string | null;
      score: number | null;
      user: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        organization: { name: string | null } | { name: string | null }[] | null;
      } | { id: string; first_name: string | null; last_name: string | null; email: string | null; organization: unknown }[] | null;
    };
    rows = ((enrollments as unknown as EnrollmentRow[]) ?? [])
      .filter((e) => {
        if (!passingOnly) return true;
        const course = creditsByCourse.get(e.course_id);
        if (!course) return false;
        // If the course has no passing score set (0), accept any completed enrollment.
        if (course.passingScore <= 0) return true;
        return (e.score ?? 0) >= course.passingScore;
      })
      .map((e) => {
        const course = creditsByCourse.get(e.course_id);
        const userObj = Array.isArray(e.user) ? e.user[0] ?? null : e.user;
        const orgRaw = userObj?.organization;
        const orgName = Array.isArray(orgRaw)
          ? (orgRaw[0] as { name: string | null } | undefined)?.name ?? ""
          : ((orgRaw as { name: string | null } | null)?.name ?? "");
        return {
          enrollmentId: e.id,
          userId: userObj?.id ?? e.user_id,
          learnerName: `${userObj?.first_name ?? ""} ${userObj?.last_name ?? ""}`.trim() || "Unknown",
          learnerEmail: userObj?.email ?? "",
          organization: orgName,
          courseTitle: course?.title ?? "Unknown course",
          courseVersion: course?.version ?? "",
          cpeCredits: course?.credits ?? 0,
          completedAt: e.completed_at ?? "",
          score: e.score,
          passingScore: course?.passingScore ?? 0,
        };
      });
  }

  const totalCredits = rows.reduce((sum, r) => sum + r.cpeCredits, 0);
  const uniqueLearners = new Set(rows.map((r) => r.userId)).size;

  return (
    <CpeReportClient
      rows={rows}
      from={from}
      to={to}
      passingOnly={passingOnly}
      totalCredits={totalCredits}
      uniqueLearners={uniqueLearners}
      eligibleCourseCount={eligibleCourses.length}
    />
  );
}
