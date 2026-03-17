import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from '@/lib/supabase/server';
import UsersClient from './users-client';
import type { UserItem } from './users-client';

export const metadata: Metadata = {
  title: "Manage Users | LMS Platform",
  description: "Manage user accounts, roles, and organizational assignments",
};

const roleMap: Record<string, UserItem['role']> = {
  super_admin: 'admin',
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

export default async function UsersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || dbUser.role !== "admin") redirect("/dashboard");

  const { data: rows, error } = await supabase
    .from('users')
    .select('*, organization:organizations(name)')
    .order('created_at', { ascending: false });

  const users: UserItem[] = (rows ?? []).map((row: any) => ({
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? '',
    role: roleMap[row.role] ?? 'learner',
    department: row.organization?.name ?? 'General',
    status: statusMap[row.status] ?? 'inactive',
    lastActive: row.updated_at ?? '',
    avatar: `${(row.first_name ?? '?')[0]}${(row.last_name ?? '?')[0]}`.toUpperCase(),
  }));

  return <UsersClient users={users} />;
}
