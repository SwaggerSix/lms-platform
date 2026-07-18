import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from "@/lib/supabase/service";
import UsersClient from './users-client';
import type { UserItem } from './users-client';

export const metadata: Metadata = {
  title: "Manage Users | LMS Platform",
  description: "Manage user accounts, roles, and organizational assignments",
};

const roleMap: Record<string, UserItem['role']> = {
  super_admin: 'super_admin',
  admin: 'admin',
  manager: 'manager',
  instructor: 'instructor',
  learner: 'learner',
};

const statusMap: Record<string, UserItem['status']> = {
  active: 'active',
  inactive: 'inactive',
  suspended: 'inactive',
};

// Maps a DataTable column key to the DB column used for server-side sort.
const SORT_COLUMNS: Record<string, string> = {
  name: "first_name",
  email: "email",
  role: "role",
  department: "organization_id",
  status: "status",
  lastActive: "updated_at",
};

const PAGE_SIZE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || dbUser.role !== "admin" && dbUser.role !== "super_admin") redirect("/dashboard");

  // ─── Server-driven paging / filtering / sorting (UX review §1.5) ───
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  // Sanitize search: PostgREST .or()/ilike break on , ( ) % * \, so strip them.
  const q = (sp.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const roleParam = sp.role && sp.role in roleMap ? sp.role : null;
  const statusParam = sp.status ?? null; // "active" | "inactive" | "pending"
  const deptId = sp.dept && sp.dept !== "all" ? sp.dept : null;
  const sort = sp.sort ?? "-created_at";
  const sortDesc = sort.startsWith("-");
  const sortField = SORT_COLUMNS[sort.replace(/^-/, "")] ?? "created_at";

  let query = service
    .from('users')
    .select('*, organization:organizations(name)', { count: 'exact' });

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`
    );
  }
  if (roleParam) query = query.eq('role', roleParam);
  if (statusParam === 'active') query = query.eq('status', 'active');
  else if (statusParam === 'inactive') query = query.in('status', ['inactive', 'suspended']);
  else if (statusParam === 'pending') query = query.eq('status', 'pending');
  if (deptId) query = query.eq('organization_id', deptId);

  const { data: rows, count, error } = await query
    .order(sortField, { ascending: !sortDesc })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data: orgRows } = await service
    .from('organizations')
    .select('id, name')
    .order('name');

  const organizations = (orgRows ?? []).map((o: any) => ({ id: o.id, name: o.name }));

  // Managers/admins available as a "reports to" selection in the Add User form.
  const { data: managerRows } = await service
    .from('users')
    .select('id, first_name, last_name, email')
    .in('role', ['admin', 'manager', 'super_admin'])
    .eq('status', 'active')
    .order('first_name');

  const managers = (managerRows ?? []).map((m: any) => ({
    id: m.id,
    name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email || m.id,
  }));

  const users: UserItem[] = (rows ?? []).map((row: any) => ({
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? '',
    role: roleMap[row.role] ?? 'learner',
    department: row.organization?.name ?? 'Unassigned',
    departmentId: row.organization_id ?? '',
    jobTitle: row.job_title ?? '',
    status: statusMap[row.status] ?? 'inactive',
    lastActive: row.updated_at ?? '',
    avatar: `${(row.first_name ?? '?')[0]}${(row.last_name ?? '?')[0]}`.toUpperCase(),
    customRoleId: row.custom_role_id ?? '',
  }));

  return (
    <UsersClient
      users={users}
      organizations={organizations}
      managers={managers}
      currentUserRole={dbUser.role}
      totalCount={count ?? users.length}
      page={page}
      pageSize={PAGE_SIZE}
      sort={sort}
    />
  );
}
