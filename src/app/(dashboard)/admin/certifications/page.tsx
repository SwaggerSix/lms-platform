import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CertificationsClient, { type CertificationItem } from './certifications-client';

const GRADIENTS = [
  'from-green-500 to-emerald-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-600',
  'from-amber-500 to-orange-600',
  'from-red-500 to-rose-600',
  'from-pink-500 to-fuchsia-600',
  'from-cyan-500 to-teal-600',
  'from-yellow-500 to-amber-600',
];

export default async function CertificationsPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Verify user exists in users table
  const { data: dbUser } = await service
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!dbUser) {
    redirect('/login');
  }

  // Fetch certifications with linked course/path names
  const { data: rows } = await service
    .from('certifications')
    .select('*, recertification_course:courses!recertification_course_id(title), recertification_path:learning_paths!recertification_path_id(title)')
    .order('created_at', { ascending: false });

  // Fetch user_certifications status counts grouped by certification_id
  const { data: statusRows } = await service
    .from('user_certifications')
    .select('certification_id, status')
    .limit(200);

  // Aggregate counts per certification
  const countsMap: Record<string, { issued: number; active: number; expired: number }> = {};
  for (const row of statusRows ?? []) {
    const cid = row.certification_id;
    if (!countsMap[cid]) {
      countsMap[cid] = { issued: 0, active: 0, expired: 0 };
    }
    countsMap[cid].issued += 1;
    if (row.status === 'active') {
      countsMap[cid].active += 1;
    } else if (row.status === 'expired' || row.status === 'revoked') {
      countsMap[cid].expired += 1;
    }
  }

  const certifications: CertificationItem[] = (rows ?? []).map((row: any, index: number) => {
    const counts = countsMap[row.id] ?? { issued: 0, active: 0, expired: 0 };

    // Determine validity period display
    let validityPeriod = 'No expiration';
    if (row.validity_months) {
      validityPeriod = row.validity_months === 1
        ? '1 month'
        : `${row.validity_months} months`;
    }

    // Determine linked course or path name
    const linkedCourse =
      (row as any).recertification_course?.title ??
      (row as any).recertification_path?.title ??
      'None';

    return {
      id: row.id,
      name: row.name ?? 'Untitled Certification',
      description: row.description ?? '',
      validityPeriod,
      linkedCourse,
      issuedCount: counts.issued,
      activeCount: counts.active,
      expiredCount: counts.expired,
      color: GRADIENTS[index % GRADIENTS.length],
    };
  });

  return <CertificationsClient certifications={certifications} />;
}
