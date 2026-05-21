import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ComplianceClient from './compliance-client';
import type { ComplianceRequirement, ComplianceUserStatus, ComplianceOverviewStat } from './compliance-client';
import { createServiceClient } from "@/lib/supabase/service";
import { readRequiredFor } from "@/lib/courses/required-training";

function formatFrequency(months: number | null | undefined): string {
  if (!months) return 'One-time';
  if (months === 12) return 'Annual';
  if (months === 24) return 'Bi-Annual';
  if (months === 6) return 'Semi-Annual';
  if (months === 3) return 'Quarterly';
  return `Every ${months} months`;
}

function deriveUserComplianceStatus(
  enrollmentStatus: string | null,
  completedAt: string | null,
  dueDate: string | null,
  frequencyMonths: number | null | undefined
): 'compliant' | 'overdue' | 'pending' | 'expired' {
  const now = new Date();

  if (enrollmentStatus === 'completed' && completedAt) {
    if (frequencyMonths) {
      const expiresAt = new Date(completedAt);
      expiresAt.setMonth(expiresAt.getMonth() + frequencyMonths);
      if (expiresAt < now) return 'expired';
    }
    return 'compliant';
  }

  if (dueDate && new Date(dueDate) < now) return 'overdue';

  return 'pending';
}

function formatRoles(roles: string[] | null | undefined): string {
  if (!roles || roles.length === 0) return 'All Employees';
  return roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')).join(', ');
}

interface NormalizedSource {
  /** Stable id for the row: prefer `course:<courseId>` when course-backed, else `legacy:<id>` */
  id: string;
  name: string;
  regulation: string;
  mandatory: boolean;
  frequencyMonths: number | null;
  applicableRoles: string[];
  courseId: string | null;
  courseName: string;
  origin: 'course' | 'legacy';
}

export default async function CompliancePage() {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: dbUser } = await service
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (!dbUser) redirect('/login');

  // 1. Pull courses with required_for set on metadata (new system, source of truth).
  const { data: courseRowsRaw } = await service
    .from('courses')
    .select('id, title, metadata')
    .neq('status', 'archived');

  const courseSources: NormalizedSource[] = [];
  const handledCourseIds = new Set<string>();
  for (const row of (courseRowsRaw ?? []) as any[]) {
    const required = readRequiredFor(row.metadata);
    if (!required) continue;
    handledCourseIds.add(row.id);
    courseSources.push({
      id: `course:${row.id}`,
      name: row.title ?? 'Untitled Course',
      regulation: required.regulation ?? '',
      mandatory: required.is_mandatory !== false,
      frequencyMonths: required.frequency_months ?? null,
      applicableRoles: required.roles,
      courseId: row.id,
      courseName: row.title ?? 'Untitled Course',
      origin: 'course',
    });
  }

  // 2. Pull legacy compliance_requirements — merge in any whose course isn't
  // already covered by the new system. (Once backfill is run, this becomes a no-op.)
  const { data: legacyRows } = await service
    .from('compliance_requirements')
    .select('*, course:courses(id, title)')
    .order('created_at', { ascending: false });

  const legacySources: NormalizedSource[] = [];
  for (const row of (legacyRows ?? []) as any[]) {
    if (row.course_id && handledCourseIds.has(row.course_id)) {
      // The course already carries the data — skip to avoid double-counting.
      continue;
    }
    legacySources.push({
      id: `legacy:${row.id}`,
      name: row.name,
      regulation: row.regulation ?? '',
      mandatory: row.is_mandatory ?? true,
      frequencyMonths: row.frequency_months ?? null,
      applicableRoles: row.applicable_roles ?? [],
      courseId: row.course_id ?? null,
      courseName: row.course?.title ?? 'No linked course',
      origin: 'legacy',
    });
  }

  const allSources = [...courseSources, ...legacySources];

  // 3. For each source, compute enrollment-derived status. Course-backed
  // sources need fresh enrollment lookups; legacy sources use their linked
  // course_id (if any). Run all enrollment fetches in parallel.
  const enrolledCourseIds = Array.from(
    new Set(allSources.map((s) => s.courseId).filter((id): id is string => !!id))
  );
  const enrollmentsByCourse: Record<string, any[]> = {};
  if (enrolledCourseIds.length > 0) {
    const { data: enrollmentRows } = await service
      .from('enrollments')
      .select('*, user:users(id, first_name, last_name, organization:organizations(name))')
      .in('course_id', enrolledCourseIds)
      .limit(5000);
    for (const e of (enrollmentRows ?? []) as any[]) {
      const list = enrollmentsByCourse[e.course_id] ?? [];
      list.push(e);
      enrollmentsByCourse[e.course_id] = list;
    }
  }

  const requirements: ComplianceRequirement[] = [];
  let totalOverdue = 0;
  let totalUpcoming = 0;
  let weightedComplianceSum = 0;
  let weightedComplianceCount = 0;

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  for (const source of allSources) {
    const enrollments = source.courseId ? enrollmentsByCourse[source.courseId] ?? [] : [];
    const totalUsers = enrollments.length;
    let compliantUsers = 0;
    let overdueUsers = 0;
    const userStatusList: ComplianceUserStatus[] = [];

    for (const enrollment of enrollments) {
      const userName = enrollment.user
        ? `${enrollment.user.first_name ?? ''} ${enrollment.user.last_name ?? ''}`.trim()
        : 'Unknown User';
      const department = enrollment.user?.organization?.name ?? 'General';
      const status = deriveUserComplianceStatus(
        enrollment.status,
        enrollment.completed_at,
        enrollment.due_date,
        source.frequencyMonths
      );

      if (status === 'compliant') compliantUsers++;
      if (status === 'overdue') overdueUsers++;

      if (userStatusList.length < 10) {
        const completedDate = enrollment.completed_at
          ? new Date(enrollment.completed_at).toISOString().split('T')[0]
          : null;
        let dueDate = '';
        if (enrollment.due_date) {
          dueDate = new Date(enrollment.due_date).toISOString().split('T')[0];
        } else if (enrollment.completed_at && source.frequencyMonths) {
          const d = new Date(enrollment.completed_at);
          d.setMonth(d.getMonth() + source.frequencyMonths);
          dueDate = d.toISOString().split('T')[0];
        }
        userStatusList.push({
          name: userName,
          department,
          status,
          completedDate,
          dueDate,
        });
      }

      if (enrollment.status === 'completed' && enrollment.completed_at && source.frequencyMonths) {
        const expiresAt = new Date(enrollment.completed_at);
        expiresAt.setMonth(expiresAt.getMonth() + source.frequencyMonths);
        if (expiresAt > now && expiresAt <= thirtyDaysFromNow) {
          totalUpcoming++;
        }
      }
    }

    totalOverdue += overdueUsers;
    const complianceRate = totalUsers > 0 ? Math.round((compliantUsers / totalUsers) * 100) : 0;
    weightedComplianceSum += complianceRate * totalUsers;
    weightedComplianceCount += totalUsers;

    requirements.push({
      id: source.id,
      name: source.name,
      regulation: source.regulation,
      mandatory: source.mandatory,
      applicableTo: formatRoles(source.applicableRoles),
      linkedCourse: source.courseName,
      frequency: formatFrequency(source.frequencyMonths),
      complianceRate,
      totalUsers,
      compliantUsers,
      overdueUsers,
      userStatus: userStatusList,
      origin: source.origin,
    });
  }

  const overallComplianceRate = weightedComplianceCount > 0
    ? (weightedComplianceSum / weightedComplianceCount).toFixed(1)
    : '0.0';

  const overviewStats: ComplianceOverviewStat[] = [
    { label: 'Total Requirements', value: String(requirements.length) },
    { label: 'Compliance Rate', value: `${overallComplianceRate}%` },
    { label: 'Overdue', value: String(totalOverdue) },
    { label: 'Upcoming Expirations', value: String(totalUpcoming) },
  ];

  const { data: courseListRows } = await service
    .from('courses')
    .select('id, title')
    .eq('status', 'published')
    .order('title');

  const courses = (courseListRows ?? []).map((c: any) => ({ id: c.id, title: c.title }));

  return <ComplianceClient requirements={requirements} overviewStats={overviewStats} courses={courses} />;
}
