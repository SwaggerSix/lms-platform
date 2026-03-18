import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ComplianceClient from './compliance-client';
import type { ComplianceRequirement, ComplianceUserStatus, ComplianceOverviewStat } from './compliance-client';
import { createServiceClient } from "@/lib/supabase/service";

function formatFrequency(months: number | null): string {
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
  frequencyMonths: number | null
): 'compliant' | 'overdue' | 'pending' | 'expired' {
  const now = new Date();

  if (enrollmentStatus === 'completed' && completedAt) {
    // If there is a frequency, check whether the completion has expired
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

export default async function CompliancePage() {
  const supabase = await createClient();
  const service = createServiceClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify user exists in users table
  const { data: dbUser } = await service
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (!dbUser) redirect('/login');

  // Fetch compliance requirements with linked course info
  const { data: reqRows } = await service
    .from('compliance_requirements')
    .select('*, course:courses(id, title)')
    .order('created_at', { ascending: false });

  const requirements: ComplianceRequirement[] = [];
  let totalOverdue = 0;
  let totalUpcoming = 0;
  let weightedComplianceSum = 0;
  let weightedComplianceCount = 0;

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  for (const row of (reqRows ?? []) as any[]) {
    const courseId = row.course_id;
    const courseName = row.course?.title ?? 'No linked course';

    // Fetch enrollments for this course with user details
    let userStatusList: ComplianceUserStatus[] = [];
    let totalUsers = 0;
    let compliantUsers = 0;
    let overdueUsers = 0;

    if (courseId) {
      // Get users who should be enrolled (based on applicable roles) and their enrollment status
      const { data: enrollmentRows } = await service
        .from('enrollments')
        .select('*, user:users(id, first_name, last_name, organization:organizations(name))')
        .eq('course_id', courseId)
        .limit(500);

      const enrollments = (enrollmentRows ?? []) as any[];
      totalUsers = enrollments.length;

      for (const enrollment of enrollments) {
        const userName = enrollment.user
          ? `${enrollment.user.first_name ?? ''} ${enrollment.user.last_name ?? ''}`.trim()
          : 'Unknown User';
        const department = enrollment.user?.organization?.name ?? 'General';
        const status = deriveUserComplianceStatus(
          enrollment.status,
          enrollment.completed_at,
          enrollment.due_date,
          row.frequency_months
        );

        if (status === 'compliant') compliantUsers++;
        if (status === 'overdue') overdueUsers++;

        // Build the user status list (limit to first 10 for the expandable view)
        if (userStatusList.length < 10) {
          const completedDate = enrollment.completed_at
            ? new Date(enrollment.completed_at).toISOString().split('T')[0]
            : null;

          let dueDate = '';
          if (enrollment.due_date) {
            dueDate = new Date(enrollment.due_date).toISOString().split('T')[0];
          } else if (enrollment.completed_at && row.frequency_months) {
            const d = new Date(enrollment.completed_at);
            d.setMonth(d.getMonth() + row.frequency_months);
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

        // Count upcoming expirations (completed enrollments expiring within 30 days)
        if (enrollment.status === 'completed' && enrollment.completed_at && row.frequency_months) {
          const expiresAt = new Date(enrollment.completed_at);
          expiresAt.setMonth(expiresAt.getMonth() + row.frequency_months);
          if (expiresAt > now && expiresAt <= thirtyDaysFromNow) {
            totalUpcoming++;
          }
        }
      }
    }

    totalOverdue += overdueUsers;

    const complianceRate = totalUsers > 0 ? Math.round((compliantUsers / totalUsers) * 100) : 0;
    weightedComplianceSum += complianceRate * totalUsers;
    weightedComplianceCount += totalUsers;

    // Format applicable roles for display
    const applicableTo = row.applicable_roles && row.applicable_roles.length > 0
      ? row.applicable_roles.map((r: string) => r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')).join(', ')
      : 'All Employees';

    requirements.push({
      id: row.id,
      name: row.name,
      regulation: row.regulation ?? '',
      mandatory: row.is_mandatory ?? true,
      applicableTo,
      linkedCourse: courseName,
      frequency: formatFrequency(row.frequency_months),
      complianceRate,
      totalUsers,
      compliantUsers,
      overdueUsers,
      userStatus: userStatusList,
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

  return <ComplianceClient requirements={requirements} overviewStats={overviewStats} />;
}
