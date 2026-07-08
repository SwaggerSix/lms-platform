'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';
import { useToast } from '@/components/ui/toast';
import { Button } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getHelp } from "@/lib/help-content";
import { assignableRoles, ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import {
  Search,
  Plus,
  Users,
  Edit,
  UserX,
  KeyRound,
  Send,
  Copy,
  Check,
  Mail,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export interface UserItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  department: string;
  departmentId: string;
  jobTitle: string;
  status: 'active' | 'inactive' | 'pending';
  lastActive: string;
  avatar: string;
}

export interface OrgItem {
  id: string;
  name: string;
}

const statuses = ['All Status', 'Active', 'Inactive', 'Pending'];
const departments = ['All Departments', 'Executive', 'HR', 'Operations', 'Finance', 'Training Delivery', 'Training Development'];

const roleBadge: Record<string, string> = {
  super_admin: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  admin: 'bg-red-50 text-red-700 ring-red-600/20',
  manager: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  instructor: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  learner: 'bg-gray-50 text-gray-700 ring-gray-600/20',
};

const statusBadge: Record<string, string> = {
  active: 'bg-green-50 text-green-700 ring-green-600/20',
  inactive: 'bg-gray-50 text-gray-500 ring-gray-500/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

export default function UsersClient({ users, organizations = [], currentUserRole = 'admin' }: { users: UserItem[]; organizations?: OrgItem[]; currentUserRole?: UserRole }) {
  const toast = useToast();
  // Roles the current admin is permitted to assign. Only Super Admins (gC/GGS)
  // can grant the Super Admin role.
  const assignable = assignableRoles(currentUserRole);
  const roleOptions = assignable.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const roleFilters: { value: string; label: string }[] = [
    { value: 'All Roles', label: 'All Roles' },
    ...roleOptions,
  ];
  const [userList, setUserList] = useState<UserItem[]>(users);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [showModal, setShowModal] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; link: string; emailed: boolean } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Form state for Add User modal
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('learner');
  const [formDepartment, setFormDepartment] = useState(organizations[0]?.id ?? '');

  // Edit User modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('learner');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'pending'>('active');

  // Loading & error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Credentials modal shown after a new user is created
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<UserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const resetForm = () => {
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormRole('learner');
    setFormDepartment(organizations[0]?.id ?? '');
    setError(null);
  };

  const handleAddUser = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail,
          first_name: formFirstName,
          last_name: formLastName,
          role: formRole,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to create user');
      }
      const created = await res.json();
      const newUser: UserItem = {
        id: created.id,
        firstName: created.first_name ?? formFirstName,
        lastName: created.last_name ?? formLastName,
        email: created.email ?? formEmail,
        role: created.role ?? formRole,
        department: organizations.find(o => o.id === formDepartment)?.name ?? 'Unassigned',
        departmentId: formDepartment,
        jobTitle: created.job_title ?? '',
        status: created.status ?? 'active',
        lastActive: created.created_at ?? new Date().toISOString(),
        avatar: `${(created.first_name ?? formFirstName)[0]}${(created.last_name ?? formLastName)[0]}`.toUpperCase(),
      };
      setUserList((prev) => [newUser, ...prev]);
      if (created.temporary_password) {
        setCredentials({ email: newUser.email, password: created.temporary_password });
      }
      resetForm();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to deactivate user');
      }
      setUserList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: 'inactive' as const } : u))
      );
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (userId: string) => {
    const user = userList.find((u) => u.id === userId);
    if (!user) return;
    setError(null);
    setDeleteConfirm(user);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${deleteConfirm.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to delete user');
      }
      setUserList((prev) => prev.filter((u) => u.id !== deleteConfirm.id));
      toast.success('User deleted');
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditUser = (userId: string) => {
    const user = userList.find((u) => u.id === userId);
    if (!user) return;
    setEditUser(user);
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName);
    setEditEmail(user.email);
    setEditJobTitle(user.jobTitle || '');
    setEditDepartment(user.departmentId || '');
    setEditRole(user.role);
    setEditStatus(user.status);
    setError(null);
    setShowEditModal(true);
  };

  const handleSaveEditUser = async () => {
    if (!editUser) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          email: editEmail,
          job_title: editJobTitle,
          organization_id: editDepartment || null,
          role: editRole,
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update user');
      }
      setUserList((prev) =>
        prev.map((u) =>
          u.id === editUser.id
            ? {
                ...u,
                firstName: editFirstName,
                lastName: editLastName,
                email: editEmail,
                jobTitle: editJobTitle,
                department: organizations.find(o => o.id === editDepartment)?.name ?? u.department,
                departmentId: editDepartment,
                role: editRole,
                status: editStatus,
                avatar: `${editFirstName[0]}${editLastName[0]}`.toUpperCase(),
              }
            : u
        )
      );
      setShowEditModal(false);
      setEditUser(null);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async (userId: string) => {
    const user = userList.find((u) => u.id === userId);
    if (!user) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${userId}/resend-invite`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend invitation');
      setInviteResult({ email: data.email ?? user.email, link: data.action_link, emailed: !!data.emailed });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to resend invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteResult?.link) return;
    try {
      await navigator.clipboard.writeText(inviteResult.link);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the link and copy manually');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Are you sure you want to send a password reset email to this user?')) return;
    const user = userList.find((u) => u.id === userId);
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetError) throw resetError;
      toast.success('Password reset email sent');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send password reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = userList.filter((u) => {
    const matchesSearch =
      !search ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'All Status' || u.status === statusFilter.toLowerCase();
    const matchesDept = deptFilter === 'All Departments' || u.department === deptFilter;
    return matchesSearch && matchesRole && matchesStatus && matchesDept;
  });

  const userColumns: DataTableColumn<UserItem>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (user) => `${user.firstName} ${user.lastName}`.toLowerCase(),
      render: (user) => (
        <div className="flex items-center gap-3 whitespace-nowrap">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
            {user.avatar}
          </div>
          <span className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortValue: (user) => user.email,
      render: (user) => <span className="text-sm text-gray-500">{user.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      sortValue: (user) => ROLE_LABELS[user.role],
      render: (user) => (
        <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', roleBadge[user.role])}>
          {ROLE_LABELS[user.role]}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortValue: (user) => user.department,
      render: (user) => <span className="text-sm text-gray-500">{user.department}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (user) => user.status,
      render: (user) => (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', statusBadge[user.status])}>
          {user.status}
        </span>
      ),
    },
    {
      key: 'lastActive',
      header: 'Last Active',
      sortValue: (user) => user.lastActive,
      render: (user) => <span className="whitespace-nowrap text-sm text-gray-500">{formatDate(user.lastActive)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (user) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleResendInvite(user.id)}
            disabled={isSubmitting}
            title="Resend invitation"
          >
            <Send className="h-3.5 w-3.5" /> Resend invite
          </Button>
          <RowActionsMenu
            label={`Actions for ${user.firstName} ${user.lastName}`}
            actions={[
              { label: 'Edit User', icon: <Edit className="h-3.5 w-3.5" />, onSelect: () => handleEditUser(user.id) },
              { label: 'Deactivate', icon: <UserX className="h-3.5 w-3.5" />, onSelect: () => handleDeactivate(user.id), disabled: isSubmitting || user.status === 'inactive' },
              { label: 'Resend Invitation', icon: <Send className="h-3.5 w-3.5" />, onSelect: () => handleResendInvite(user.id), disabled: isSubmitting },
              { label: 'Reset Password', icon: <KeyRound className="h-3.5 w-3.5" />, onSelect: () => handleResetPassword(user.id) },
              { label: 'Delete User', icon: <Trash2 className="h-3.5 w-3.5" />, onSelect: () => handleDeleteClick(user.id), destructive: true },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <InfoTooltip content={getHelp("admin.users").details} label="About User Management" side="bottom" />
          </div>
          <p className="mt-1 text-sm text-gray-500">{userList.length} total users</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          {roleFilters.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={userColumns}
        rows={filtered}
        rowKey={(user) => user.id}
        pageSize={10}
        ariaLabel="Users"
        emptyState={
          userList.length === 0
            ? {
                icon: <Users className="h-10 w-10" aria-hidden="true" />,
                title: 'No users yet',
                description: 'Add a user to get started',
                action: (
                  <Button onClick={() => setShowModal(true)}>
                    <Plus className="h-4 w-4" />
                    Add User
                  </Button>
                ),
              }
            : undefined
        }
      />

      {/* Delete User Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !isDeleting && setDeleteConfirm(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete User</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to permanently delete{' '}
              <span className="font-medium text-gray-900">{deleteConfirm.firstName} {deleteConfirm.lastName}</span>?
              Their account and access to the platform will be removed.
            </p>
            {error && (
              <p className="mb-4 text-sm text-red-600">{error}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invitation link modal */}
      {inviteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setInviteResult(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Invitation for {inviteResult.email}</h2>
              <button onClick={() => setInviteResult(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 flex items-center gap-2 text-sm text-gray-600">
              {inviteResult.emailed ? (
                <><Mail className="h-4 w-4 text-green-600" /> Emailed to {inviteResult.email}. You can also copy the link below to share directly.</>
              ) : (
                <><AlertTriangle className="h-4 w-4 text-amber-500" /> Email wasn&apos;t sent (email delivery isn&apos;t configured). Copy this link and share it with the user.</>
              )}
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteResult.link}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              />
              <Button onClick={copyInviteLink} className="shrink-0">
                {inviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {inviteCopied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-400">This link lets the user set their password and sign in. It expires for security, so resend if it lapses.</p>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
              <button onClick={() => { setShowEditModal(false); setEditUser(null); setError(null); }} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-user-first-name" className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                  <input id="edit-user-first-name" type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label htmlFor="edit-user-last-name" className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                  <input id="edit-user-last-name" type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label htmlFor="edit-user-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input id="edit-user-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-user-job-title" className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
                  <input id="edit-user-job-title" type="text" placeholder="e.g. Consultant" value={editJobTitle} onChange={(e) => setEditJobTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label htmlFor="edit-user-department" className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                  <select id="edit-user-department" value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="">Unassigned</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-user-role" className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                  <select id="edit-user-role" value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-user-status" className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select id="edit-user-status" value={editStatus} onChange={(e) => setEditStatus(e.target.value as typeof editStatus)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>
            {error && showEditModal && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowEditModal(false); setEditUser(null); setError(null); }}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditUser}
                disabled={isSubmitting || !editEmail || !editFirstName || !editLastName}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Credentials Modal */}
      {credentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Login credentials</h2>
              <button onClick={() => setCredentials(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Share these credentials with the user. This password will not be shown again — copy it now.
              On first login they will be prompted to set their own password.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={credentials.email} className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-900" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(credentials.email)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Temporary password</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={credentials.password} className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-900" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(credentials.password)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setCredentials(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Add New User</h2>
              <button onClick={() => { resetForm(); setShowModal(false); }} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="add-user-first-name" className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                  <input id="add-user-first-name" type="text" placeholder="John" value={formFirstName} onChange={(e) => setFormFirstName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label htmlFor="add-user-last-name" className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                  <input id="add-user-last-name" type="text" placeholder="Doe" value={formLastName} onChange={(e) => setFormLastName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label htmlFor="add-user-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input id="add-user-email" type="email" placeholder="john.doe@acme.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label htmlFor="add-user-role" className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select id="add-user-role" value={formRole} onChange={(e) => setFormRole(e.target.value as UserRole)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="add-user-department" className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <select id="add-user-department" value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="">Select Department</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="add-user-manager" className="block text-sm font-medium text-gray-700 mb-1.5">Manager</label>
                <select id="add-user-manager" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option>Chris Cancialosi</option>
                  <option>Elizabeth Bauernshub</option>
                </select>
              </div>
            </div>
            {error && showModal && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { resetForm(); setShowModal(false); }}>
                Cancel
              </Button>
              <Button
                onClick={handleAddUser}
                disabled={isSubmitting || !formEmail || !formFirstName || !formLastName}
              >
                {isSubmitting ? 'Adding...' : 'Add User'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
