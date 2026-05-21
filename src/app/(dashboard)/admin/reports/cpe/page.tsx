import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CpeReportClient from "./cpe-report-client";
import type { CpeRow } from "./cpe-report-client";

export const metadata: Metadata = {
  title: "NASBA CPE Report | LMS Platform",
  description: "Track NASBA CPE credits earned by learners through course completions",
};

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
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
  if (!["admin", "super_admin", "manager"].includes(dbUser.role)) redirect("/dashboard");

  const params = await searchParams;
  const defaultFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultTo = new Date().toISOString().slice(0, 10);
  const from = params.from || defaultFrom;
  const to = params.to || defaultTo;

  const { data: cpeCourses } = await service
    .from("courses")
    .select("id, title, metadata");

  const eligibleCourses = (cpeCourses ?? []).filter((c) => {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    return !!meta.nasba_cpe;
  });

  const creditsByCourse = new Map<string, { title: string; credits: number; version: string }>();
  for (const c of eligibleCourses) {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    creditsByCourse.set(c.id, {
      title: c.title,
      credits: Number(meta.cpe_credits) || 0,
      version: (meta.course_version as string) || "",
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
    rows = ((enrollments as unknown as EnrollmentRow[]) ?? []).map((e) => {
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
      totalCredits={totalCredits}
      uniqueLearners={uniqueLearners}
      eligibleCourseCount={eligibleCourses.length}
    />
  );
}
