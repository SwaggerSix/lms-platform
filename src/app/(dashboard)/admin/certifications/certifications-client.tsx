'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';
import {
  Plus,
  Award,
  Calendar,
  Users,
  BookOpen,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  X,
  Loader2,
  Palette,
} from 'lucide-react';
import Link from 'next/link';

export interface CertificationItem {
  id: string;
  name: string;
  description: string;
  validityPeriod: string;
  linkedCourse: string;
  issuedCount: number;
  activeCount: number;
  expiredCount: number;
  color: string;
}

interface CertificationsClientProps {
  certifications: CertificationItem[];
}

interface CertFormData {
  name: string;
  description: string;
  validity_period: string;
  course_requirements: string;
}

const emptyForm: CertFormData = {
  name: '',
  description: '',
  validity_period: '',
  course_requirements: '',
};

export default function CertificationsClient({ certifications: initialCerts }: CertificationsClientProps) {
  const [certifications, setCertifications] = useState(initialCerts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<CertificationItem | null>(null);
  const [formData, setFormData] = useState<CertFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openCreateModal = () => {
    setEditingCert(null);
    setFormData(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (cert: CertificationItem) => {
    setEditingCert(cert);
    setFormData({
      name: cert.name,
      description: cert.description,
      validity_period: cert.validityPeriod,
      course_requirements: cert.linkedCourse,
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCert(null);
    setFormData(emptyForm);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingCert) {
        const res = await fetch('/api/certifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCert.id, ...formData }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update certification');
        }
        const updated = await res.json();
        setCertifications((prev) =>
          prev.map((c) =>
            c.id === editingCert.id
              ? {
                  ...c,
                  name: updated.name || formData.name,
                  description: updated.description || formData.description,
                  validityPeriod: updated.validity_period || formData.validity_period,
                  linkedCourse: updated.course_requirements || formData.course_requirements,
                }
              : c
          )
        );
      } else {
        const res = await fetch('/api/certifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create certification');
        }
        const created = await res.json();
        setCertifications((prev) => [
          {
            id: created.id,
            name: created.name || formData.name,
            description: created.description || formData.description,
            validityPeriod: created.validity_period || formData.validity_period,
            linkedCourse: created.course_requirements || formData.course_requirements,
            issuedCount: 0,
            activeCount: 0,
            expiredCount: 0,
            color: 'from-indigo-500 to-blue-600',
          },
          ...prev,
        ]);
      }
      closeModal();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/certifications?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete certification');
      }
      setCertifications((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certifications</h1>
          <p className="mt-1 text-sm text-gray-500">{certifications.length} certifications configured</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/certifications/designer"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 transition-colors"
          >
            <Palette className="h-4 w-4" />
            Certificate Designer
          </Link>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Certification
          </button>
        </div>
      </div>

      {/* Global error */}
      {error && !modalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Certification Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {certifications.map((cert) => (
          <div key={cert.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className={cn('bg-gradient-to-r px-6 py-4', cert.color)}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{cert.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-white/80">
                    <Calendar className="h-3.5 w-3.5" />
                    Valid for {cert.validityPeriod}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-6">
              <p className="text-sm text-gray-500 line-clamp-2">{cert.description}</p>

              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span>Linked: <span className="font-medium text-indigo-600">{cert.linkedCourse}</span></span>
              </div>

              {/* Stats */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                    <Users className="h-3 w-3" /> Issued
                  </div>
                  <p className="mt-1 text-lg font-bold text-gray-900">{formatNumber(cert.issuedCount)}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </div>
                  <p className="mt-1 text-lg font-bold text-green-700">{formatNumber(cert.activeCount)}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-red-500">
                    <XCircle className="h-3 w-3" /> Expired
                  </div>
                  <p className="mt-1 text-lg font-bold text-red-600">{formatNumber(cert.expiredCount)}</p>
                </div>
              </div>

              {/* Active rate bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">Active rate</span>
                  <span className="font-semibold text-gray-700">{cert.issuedCount > 0 ? Math.round((cert.activeCount / cert.issuedCount) * 100) : 0}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: `${cert.issuedCount > 0 ? (cert.activeCount / cert.issuedCount) * 100 : 0}%` }} />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => openEditModal(cert)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" /> Edit
                </button>
                {deleteConfirmId === cert.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(cert.id)}
                      disabled={deleteLoading}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(cert.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCert ? 'Edit Certification' : 'Create Certification'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  placeholder="Certification name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Describe the certification"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validity Period</label>
                <input
                  type="text"
                  value={formData.validity_period}
                  onChange={(e) => setFormData((f) => ({ ...f, validity_period: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. 1 year, 6 months"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Requirements</label>
                <input
                  type="text"
                  value={formData.course_requirements}
                  onChange={(e) => setFormData((f) => ({ ...f, course_requirements: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Required course name or ID"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
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
                  {editingCert ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
