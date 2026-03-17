'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';
import { useToast } from '@/components/ui/toast';
import {
  Search,
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Edit,
  UserX,
  KeyRound,
  X,
  Filter,
} from 'lucide-react';

export interface UserItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'manager' | 'instructor' | 'learner';
  department: string;
  status: 'active' | 'inactive' | 'pending';
  lastActive: string;
  avatar: string;
}

const roles = ['All Roles', 'Admin', 'Manager', 'Instructor', 'Learner'];
const statuses = ['All Status', 'Active', 'Inactive', 'Pending'];
const departments = ['All Departments', 'Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];

const roleBadge: Record<string, string> = {
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

export default function UsersClient({ users }: { users: UserItem[] }) {
  const toast = useToast();
  const [userList, setUserList] = useState<UserItem[]>(users);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Form state for Add User modal
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'learner' | 'instructor' | 'manager' | 'admin'>('learner');
  const [formDepartment, setFormDepartment] = useState('Engineering');

  // Edit User modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editRole, setEditRole] = useState<'learner' | 'instructor' | 'manager' | 'admin'>('learner');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'pending'>('active');

  // Loading & error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormRole('learner');
    setFormDepartment('Engineering');
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
        department: formDepartment,
        status: created.status ?? 'active',
        lastActive: created.created_at ?? new Date().toISOString(),
        avatar: `${(created.first_name ?? formFirstName)[0]}${(created.last_name ?? formLastName)[0]}`.toUpperCase(),
      };
      setUserList((prev) => [newUser, ...prev]);
      resetForm();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    setOpenMenu(null);
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

  const handleEditUser = (userId: string) => {
    setOpenMenu(null);
    const user = userList.find((u) => u.id === userId);
    if (!user) return;
    setEditUser(user);
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName);
    setEditEmail(user.email);
    setEditJobTitle('');
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

  const handleResetPassword = async (userId: string) => {
    setOpenMenu(null);
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
    const matchesRole = roleFilter === 'All Roles' || u.role === roleFilter.toLowerCase();
    const matchesStatus = statusFilter === 'All Status' || u.status === statusFilter.toLowerCase();
    const matchesDept = deptFilter === 'All Departments' || u.department === deptFilter;
    return matchesSearch && matchesRole && matchesStatus && matchesDept;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedUsers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showStart = (currentPage - 1) * pageSize;
  const showEnd = Math.min(currentPage * pageSize, filtered.length);

  // Compute visible page numbers (max 5)
  const getPageNumbers = () => {
    const pages: number[] = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">{userList.length} total users</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
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
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          {roles.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Department</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Active</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {user.avatar}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{user.email}</td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', roleBadge[user.role])}>
                    {user.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{user.department}</td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', statusBadge[user.status])}>
                    {user.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{formatDate(user.lastActive)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                      aria-label="User actions"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {openMenu === user.id && (
                      <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button onClick={() => handleEditUser(user.id)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Edit className="h-3.5 w-3.5" /> Edit User
                        </button>
                        <button onClick={() => handleDeactivate(user.id)} disabled={isSubmitting || user.status === 'inactive'} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                          <UserX className="h-3.5 w-3.5" /> Deactivate
                        </button>
                        <button onClick={() => handleResetPassword(user.id)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <KeyRound className="h-3.5 w-3.5" /> Reset Password
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {showStart + 1}-{showEnd} of {filtered.length} users
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            {getPageNumbers().map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium',
                  currentPage === p ? 'bg-indigo-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                )}
              >
                {p}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
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
              <div>
                <label htmlFor="edit-user-job-title" className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
                <input id="edit-user-job-title" type="text" placeholder="e.g. Software Engineer" value={editJobTitle} onChange={(e) => setEditJobTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-user-role" className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                  <select id="edit-user-role" value={editRole} onChange={(e) => setEditRole(e.target.value as typeof editRole)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="learner">Learner</option>
                    <option value="instructor">Instructor</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
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
              <button onClick={() => { setShowEditModal(false); setEditUser(null); setError(null); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSaveEditUser}
                disabled={isSubmitting || !editEmail || !editFirstName || !editLastName}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
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
                <select id="add-user-role" value={formRole} onChange={(e) => setFormRole(e.target.value as typeof formRole)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="learner">Learner</option>
                  <option value="instructor">Instructor</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label htmlFor="add-user-department" className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <select id="add-user-department" value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option>Engineering</option>
                  <option>Sales</option>
                  <option>Marketing</option>
                  <option>HR</option>
                  <option>Finance</option>
                </select>
              </div>
              <div>
                <label htmlFor="add-user-manager" className="block text-sm font-medium text-gray-700 mb-1.5">Manager</label>
                <select id="add-user-manager" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option>James Wilson</option>
                  <option>Emily Johnson</option>
                  <option>Jennifer Lee</option>
                </select>
              </div>
            </div>
            {error && showModal && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { resetForm(); setShowModal(false); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={isSubmitting || !formEmail || !formFirstName || !formLastName}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
