import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Award } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Learner CPE detail | LMS Platform",
};

interface Params {
  params: Promise<{ userId: string }>;
}

interface CompletionRow {
  enrollmentId: string;
  courseTitle: string;
  courseVersion: string;
  cpeCredits: number;
  completedAt: string;
  year: string;
  score: number | null;
  passingScore: number;
  passed: boolean;
}

export default async function LearnerCpeDetailPage({ params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: caller } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!caller) redirect("/login");
  if (!["admin", "super_admin", "manager"].includes(caller.role)) redirect("/dashboard");

  const { userId } = await params;

  const { data: learner } = await service
    .from("users")
    .select("id, first_name, last_name, email, job_title, organization:organizations(name)")
    .eq("id", userId)
    .single();

  if (!learner) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Learner not found</h1>
        <p className="mt-2 text-gray-600">No user with id {userId} exists.</p>
        <Link href="/admin/reports/cpe" className="mt-4 inline-block text-indigo-600 hover:underline">
          Back to CPE report
        </Link>
      </div>
    );
  }

  // Fetch all CPE-eligible courses
  const { data: cpeCourses } = await service
    .from("courses")
    .select("id, title, passing_score, metadata");

  const courseMap = new Map<string, { title: string; credits: number; version: string; passingScore: number }>();
  for (const c of cpeCourses ?? []) {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    if (!meta.nasba_cpe) continue;
    courseMap.set(c.id, {
      title: c.title,
      credits: Number(meta.cpe_credits) || 0,
      version: (meta.course_version as string) || "",
      passingScore: Number(c.passing_score) || 0,
    });
  }

  const cpeCourseIds = Array.from(courseMap.keys());

  let completions: CompletionRow[] = [];
  if (cpeCourseIds.length > 0) {
    const { data: rows } = await service
      .from("enrollments")
      .select("id, course_id, completed_at, score, status")
      .eq("user_id", userId)
      .eq("status", "completed")
      .in("course_id", cpeCourseIds)
      .order("completed_at", { ascending: false });

    completions = ((rows ?? []) as Array<{
      id: string;
      course_id: string;
      completed_at: string | null;
      score: number | null;
    }>).map((r) => {
      const course = courseMap.get(r.course_id);
      const score = r.score;
      const passingScore = course?.passingScore ?? 0;
      const passed = passingScore === 0 || (score ?? 0) >= passingScore;
      const completedAt = r.completed_at ?? "";
      return {
        enrollmentId: r.id,
        courseTitle: course?.title ?? "Unknown course",
        courseVersion: course?.version ?? "",
        cpeCredits: course?.credits ?? 0,
        completedAt,
        year: completedAt ? completedAt.slice(0, 4) : "—",
        score,
        passingScore,
        passed,
      };
    });
  }

  const totalEarned = completions.filter((c) => c.passed).reduce((sum, c) => sum + c.cpeCredits, 0);
  const totalUnverified = completions.filter((c) => !c.passed).reduce((sum, c) => sum + c.cpeCredits, 0);

  // Group by year
  const byYear = new Map<string, { passed: CompletionRow[]; subPassing: CompletionRow[]; credits: number }>();
  for (const c of completions) {
    const bucket = byYear.get(c.year) ?? { passed: [], subPassing: [], credits: 0 };
    if (c.passed) {
      bucket.passed.push(c);
      bucket.credits += c.cpeCredits;
    } else {
      bucket.subPassing.push(c);
    }
    byYear.set(c.year, bucket);
  }
  const years = Array.from(byYear.entries()).sort(([a], [b]) => b.localeCompare(a));

  const orgRaw = (learner as { organization?: { name?: string } | { name?: string }[] | null }).organization;
  const organizationName = Array.isArray(orgRaw) ? orgRaw[0]?.name ?? "" : orgRaw?.name ?? "";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reports/cpe" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" /> Back to CPE Report
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Award className="h-6 w-6 text-emerald-600" />
          {learner.first_name} {learner.last_name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {learner.email}
          {learner.job_title ? ` · ${learner.job_title}` : ""}
          {organizationName ? ` · ${organizationName}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Verified CPE</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {totalEarned.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </p>
          <p className="text-xs text-gray-400">credits at passing score</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sub-passing completions</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">
            {totalUnverified.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </p>
          <p className="text-xs text-gray-400">credits not counted</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">CPE Completions</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{completions.length}</p>
          <p className="text-xs text-gray-400">total enrollments completed</p>
        </div>
      </div>

      {years.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">This learner has no completed CPE-eligible courses.</p>
        </div>
      ) : (
        years.map(([year, bucket]) => (
          <div key={year} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
              <h2 className="text-base font-semibold text-gray-900">{year}</h2>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-emerald-600">
                  {bucket.credits.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span>{" "}
                verified credits ·{" "}
                {bucket.passed.length + bucket.subPassing.length} completion{bucket.passed.length + bucket.subPassing.length === 1 ? "" : "s"}
              </p>
            </div>
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3">Course</th>
                  <th className="px-6 py-3 text-right">Credits</th>
                  <th className="px-6 py-3 text-right">Score</th>
                  <th className="px-6 py-3">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...bucket.passed, ...bucket.subPassing].map((c) => (
                  <tr key={c.enrollmentId}>
                    <td className="px-6 py-3">
                      <p className="text-sm text-gray-900">{c.courseTitle}</p>
                      {c.courseVersion && <p className="text-xs text-gray-400">v{c.courseVersion}</p>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {c.passed ? (
                        <span className="font-semibold text-emerald-700">{c.cpeCredits}</span>
                      ) : (
                        <span className="text-gray-400 line-through">{c.cpeCredits}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right text-sm">
                      {c.score == null ? (
                        <span className="text-gray-400">—</span>
                      ) : c.passed ? (
                        <span className="text-gray-700">{c.score}%</span>
                      ) : (
                        <span className="text-red-600" title={`Below passing score of ${c.passingScore}%`}>
                          {c.score}% (below {c.passingScore}%)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {c.completedAt ? new Date(c.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
