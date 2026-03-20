'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { formatPercent, formatNumber } from '@/utils/format';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Eye,
  Users,
  X,
  Loader2,
  Plus,
} from 'lucide-react';

export interface ComplianceUserStatus {
  name: string;
  department: string;
  status: 'compliant' | 'overdue' | 'pending' | 'expired';
  completedDate: string | null;
  dueDate: string;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  regulation: string;
  mandatory: boolean;
  applicableTo: string;
  linkedCourse: string;
  frequency: string;
  complianceRate: number;
  totalUsers: number;
  compliantUsers: number;
  overdueUsers: number;
  userStatus: ComplianceUserStatus[];
}

export interface ComplianceOverviewStat {
  label: string;
  value: string;
}

interface ComplianceClientProps {
  requirements: ComplianceRequirement[];
  overviewStats: ComplianceOverviewStat[];
}

interface ComplianceFormData {
  name: string;
  regulation: string;
  mandatory: boolean;
  applicableTo: string;
  linkedCourse: string;
  frequency: string;
}

const statIcons = [ShieldCheck, CheckCircle2, AlertTriangle, Clock];
const statColors = ['bg-indigo-500', 'bg-green-500', 'bg-red-500', 'bg-amber-500'];

const userStatusBadge: Record<string, string> = {
  compliant: 'bg-green-50 text-green-700 ring-green-600/20',
  overdue: 'bg-red-50 text-red-700 ring-red-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  expired: 'bg-gray-100 text-gray-500 ring-gray-500/20',
};

export interface CourseOption {
  id: string;
  title: string;
}

export default function ComplianceClient({ requirements: initialRequirements, overviewStats, courses = [] }: ComplianceClientProps & { courses?: CourseOption[] }) {
  const [requirements, setRequirements] = useState(initialRequirements);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [selectedReq, setSelectedReq] = useState<ComplianceRequirement | null>(null);
  const [formData, setFormData] = useState<ComplianceFormData>({
    name: '',
    regulation: '',
    mandatory: false,
    applicableTo: '',
    linkedCourse: '',
    frequency: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = requirements.filter(
    (r) => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.regulation.toLowerCase().includes(search.toLowerCase())
  );

  const openViewModal = (req: ComplianceRequirement) => {
    setSelectedReq(req);
    setModalMode('view');
    setFormData({
      name: req.name,
      regulation: req.regulation,
      mandatory: req.mandatory,
      applicableTo: req.applicableTo,
      linkedCourse: req.linkedCourse,
      frequency: req.frequency,
    });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (req: ComplianceRequirement) => {
    setSelectedReq(req);
    setModalMode('edit');
    setFormData({
      name: req.name,
      regulation: req.regulation,
      mandatory: req.mandatory,
      applicableTo: req.applicableTo,
      linkedCourse: req.linkedCourse,
      frequency: req.frequency,
    });
    setError(null);
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedReq(null);
    setModalMode('create');
    setFormData({
      name: '',
      regulation: '',
      mandatory: true,
      applicableTo: 'All Employees',
      linkedCourse: '',
      frequency: 'Annual',
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedReq(null);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          regulation: formData.regulation,
          mandatory: formData.mandatory,
          applicable_to: formData.applicableTo,
          linked_course: formData.linkedCourse,
          frequency: formData.frequency,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create compliance requirement');
      }
      const created = await res.json();
      setRequirements((prev) => [
        {
          id: created.id ?? crypto.randomUUID(),
          name: formData.name,
          regulation: formData.regulation,
          mandatory: formData.mandatory,
          applicableTo: formData.applicableTo,
          linkedCourse: formData.linkedCourse,
          frequency: formData.frequency,
          complianceRate: 0,
          totalUsers: 0,
          compliantUsers: 0,
          overdueUsers: 0,
          userStatus: [],
        },
        ...prev,
      ]);
      closeModal();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/compliance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedReq.id,
          name: formData.name,
          regulation: formData.regulation,
          mandatory: formData.mandatory,
          applicable_to: formData.applicableTo,
          linked_course: formData.linkedCourse,
          frequency: formData.frequency,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update compliance requirement');
      }
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === selectedReq.id
            ? {
                ...r,
                name: formData.name,
                regulation: formData.regulation,
                mandatory: formData.mandatory,
                applicableTo: formData.applicableTo,
                linkedCourse: formData.linkedCourse,
                frequency: formData.frequency,
              }
            : r
        )
      );
      closeModal();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Management</h1>
          <p className="mt-1 text-sm text-gray-500">Track regulatory and training compliance</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Requirement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {overviewStats.map((stat, index) => {
          const Icon = statIcons[index] ?? ShieldCheck;
          const color = statColors[index] ?? 'bg-indigo-500';
          return (
            <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-white', color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                  <p className="mt-0.5 text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search compliance requirements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Global error */}
      {error && !modalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-4 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Requirement</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Regulation</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Mandatory</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Applicable To</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Course</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Frequency</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Compliance</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((req) => (
              <>
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <button onClick={() => setExpandedId(expandedId === req.id ? null : req.id)} className="text-gray-400 hover:text-gray-600">
                      {expandedId === req.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{req.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{req.regulation}</td>
                  <td className="px-6 py-4 text-center">
                    {req.mandatory ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">Required</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-500/20">Optional</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{req.applicableTo}</td>
                  <td className="px-6 py-4 text-sm text-indigo-600 font-medium">{req.linkedCourse}</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">{req.frequency}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-gray-100">
                        <div
                          className={cn(
                            'h-2 rounded-full',
                            req.complianceRate >= 90 ? 'bg-green-500' : req.complianceRate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                          )}
                          style={{ width: `${req.complianceRate}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{req.complianceRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openViewModal(req)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(req)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Edit requirement"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === req.id && (
                  <tr key={`${req.id}-detail`}>
                    <td colSpan={9} className="bg-gray-50/50 px-10 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">User Compliance Status</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {formatNumber(req.totalUsers)} total</span>
                          <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> {formatNumber(req.compliantUsers)} compliant</span>
                          <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" /> {req.overdueUsers} overdue</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {req.userStatus.map((user, i) => (
                          <div key={i} className="flex items-center gap-4 rounded-lg bg-white px-4 py-3 border border-gray-100">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-400">{user.department}</p>
                            </div>
                            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', userStatusBadge[user.status])}>
                              {user.status}
                            </span>
                            <div className="text-right text-xs">
                              {user.completedDate ? (
                                <p className="text-gray-500">Completed: {user.completedDate}</p>
                              ) : (
                                <p className="text-gray-400">Not completed</p>
                              )}
                              <p className="text-gray-400">Due: {user.dueDate}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* View/Edit/Create Modal */}
      {modalOpen && (selectedReq || modalMode === 'create') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {modalMode === 'view' ? 'Requirement Details' : modalMode === 'create' ? 'Add Compliance Requirement' : 'Edit Requirement'}
              </h2>
              <div className="flex items-center gap-2">
                {modalMode === 'view' && (
                  <button
                    onClick={() => setModalMode('edit')}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="h-3 w-3" /> Edit
                  </button>
                )}
                <button onClick={closeModal} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {modalMode === 'view' && selectedReq ? (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Name</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedReq.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Regulation</p>
                    <p className="text-sm text-gray-900">{selectedReq.regulation}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Mandatory</p>
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                      selectedReq.mandatory
                        ? 'bg-red-50 text-red-700 ring-red-600/20'
                        : 'bg-gray-50 text-gray-500 ring-gray-500/20'
                    )}>
                      {selectedReq.mandatory ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Applicable To</p>
                    <p className="text-sm text-gray-900">{selectedReq.applicableTo}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Linked Course</p>
                    <p className="text-sm font-medium text-indigo-600">{selectedReq.linkedCourse}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Frequency</p>
                    <p className="text-sm text-gray-900">{selectedReq.frequency}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Compliance Overview</p>
                    <span className={cn(
                      'text-sm font-bold',
                      selectedReq.complianceRate >= 90 ? 'text-green-600' : selectedReq.complianceRate >= 75 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {selectedReq.complianceRate}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100">
                    <div
                      className={cn(
                        'h-2.5 rounded-full',
                        selectedReq.complianceRate >= 90 ? 'bg-green-500' : selectedReq.complianceRate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      style={{ width: `${selectedReq.complianceRate}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-lg font-bold text-gray-900">{formatNumber(selectedReq.totalUsers)}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3 text-center">
                      <p className="text-xs text-green-600">Compliant</p>
                      <p className="text-lg font-bold text-green-700">{formatNumber(selectedReq.compliantUsers)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3 text-center">
                      <p className="text-xs text-red-500">Overdue</p>
                      <p className="text-lg font-bold text-red-600">{selectedReq.overdueUsers}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={modalMode === 'create' ? handleCreate : handleSave} className="p-6 space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Regulation</label>
                  <input
                    type="text"
                    value={formData.regulation}
                    onChange={(e) => setFormData((f) => ({ ...f, regulation: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mandatory"
                    checked={formData.mandatory}
                    onChange={(e) => setFormData((f) => ({ ...f, mandatory: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="mandatory" className="text-sm font-medium text-gray-700">Mandatory</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Applicable To</label>
                  <select
                    value={formData.applicableTo}
                    onChange={(e) => setFormData((f) => ({ ...f, applicableTo: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="All Employees">All Employees</option>
                    <option value="Executive">Executive</option>
                    <option value="HR">HR</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Training Delivery">Training Delivery</option>
                    <option value="Training Development">Training Development</option>
                    <option value="Managers Only">Managers Only</option>
                    <option value="New Hires">New Hires</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Linked Course</label>
                  <select
                    value={formData.linkedCourse}
                    onChange={(e) => setFormData((f) => ({ ...f, linkedCourse: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— Select a course —</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.title}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData((f) => ({ ...f, frequency: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="One-time">One-time</option>
                    <option value="Quarterly">Quarterly (every 3 months)</option>
                    <option value="Semi-Annual">Semi-Annual (every 6 months)</option>
                    <option value="Annual">Annual (every 12 months)</option>
                    <option value="Bi-Annual">Bi-Annual (every 24 months)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode('view')}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {modalMode === 'create' ? 'Create Requirement' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
