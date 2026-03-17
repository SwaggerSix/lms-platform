'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Search,
  ClipboardCheck,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ListChecks,
  ToggleLeft,
  AlignLeft,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'multi-select';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  points: number;
}

export interface Assessment {
  id: string;
  title: string;
  course: string;
  questionCount: number;
  passingScore: number;
  avgScore: number;
  attempts: number;
  status: 'active' | 'draft';
  questions: Question[];
}

export interface CourseOption {
  id: string;
  title: string;
}

const questionTypeIcons: Record<QuestionType, typeof CheckCircle2> = {
  'multiple-choice': CheckCircle2,
  'true-false': ToggleLeft,
  'short-answer': AlignLeft,
  'multi-select': ListChecks,
};

const questionTypeBadge: Record<QuestionType, string> = {
  'multiple-choice': 'bg-blue-50 text-blue-700',
  'true-false': 'bg-green-50 text-green-700',
  'short-answer': 'bg-purple-50 text-purple-700',
  'multi-select': 'bg-amber-50 text-amber-700',
};

const statusBadge: Record<string, string> = {
  active: 'bg-green-50 text-green-700 ring-green-600/20',
  draft: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

interface AssessmentFormData {
  title: string;
  description: string;
  course_id: string;
  time_limit: number;
  passing_score: number;
  max_attempts: number;
}

const emptyForm: AssessmentFormData = {
  title: '',
  description: '',
  course_id: '',
  time_limit: 30,
  passing_score: 70,
  max_attempts: 3,
};

interface AssessmentsClientProps {
  assessments: Assessment[];
  courses: CourseOption[];
}

export default function AssessmentsClient({ assessments: initialAssessments, courses }: AssessmentsClientProps) {
  const toast = useToast();
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssessmentFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<Assessment | null>(null);

  // Loading states
  const [loadingAction, setLoadingAction] = useState<{ id?: string; action: string } | null>(null);

  const isLoading = (action: string, id?: string) =>
    loadingAction?.action === action && (!id || loadingAction?.id === id);

  const filtered = assessments.filter(
    (a) => !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.course.toLowerCase().includes(search.toLowerCase())
  );

  // --- Handlers ---

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }, []);

  const openEditModal = useCallback((assessment: Assessment) => {
    setOpenMenu(null);
    setEditingId(assessment.id);
    // Find course_id by matching course title
    const matchedCourse = courses.find((c) => c.title === assessment.course);
    setForm({
      title: assessment.title,
      description: '',
      course_id: matchedCourse?.id ?? '',
      time_limit: 30,
      passing_score: assessment.passingScore,
      max_attempts: 3,
    });
    setFormError(null);
    setFormOpen(true);
  }, [courses]);

  const closeModal = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }, []);

  const handleFormSubmit = useCallback(async () => {
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!form.course_id) {
      setFormError('Please select a course.');
      return;
    }

    const actionType = editingId ? 'edit' : 'create';
    setLoadingAction({ id: editingId ?? undefined, action: actionType });
    setFormError(null);

    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        course_id: form.course_id,
        time_limit: form.time_limit,
        passing_score: form.passing_score,
        max_attempts: form.max_attempts,
      };

      if (editingId) {
        payload.id = editingId;
        const res = await fetch('/api/assessments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || 'Failed to update assessment');
        }
        // Optimistic update in local state
        const courseName = courses.find((c) => c.id === form.course_id)?.title ?? 'Unlinked Course';
        setAssessments((prev) =>
          prev.map((a) =>
            a.id === editingId
              ? { ...a, title: form.title.trim(), course: courseName, passingScore: form.passing_score }
              : a
          )
        );
      } else {
        const res = await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || 'Failed to create assessment');
        }
        const newAssessment = await res.json();
        const courseName = courses.find((c) => c.id === form.course_id)?.title ?? 'Unlinked Course';
        setAssessments((prev) => [
          {
            id: newAssessment.id,
            title: form.title.trim(),
            course: courseName,
            questionCount: 0,
            passingScore: form.passing_score,
            avgScore: 0,
            attempts: 0,
            status: 'draft',
            questions: [],
          },
          ...prev,
        ]);
      }

      closeModal();
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoadingAction(null);
    }
  }, [editingId, form, courses, closeModal, router]);

  const handleDeleteClick = useCallback((assessment: Assessment) => {
    setOpenMenu(null);
    setDeleteConfirm(assessment);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    setLoadingAction({ id: deleteConfirm.id, action: 'delete' });

    try {
      const res = await fetch(`/api/assessments?id=${deleteConfirm.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to delete assessment');
      }
      setAssessments((prev) => prev.filter((a) => a.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete assessment. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  }, [deleteConfirm, router]);

  const handlePreview = useCallback((assessment: Assessment) => {
    setOpenMenu(null);
    router.push(`/learn/assessments/${assessment.id}`);
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="mt-1 text-sm text-gray-500">{assessments.length} assessments configured</p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={!!loadingAction}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Create Assessment
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search assessments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-4 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Course</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Questions</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Passing</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Avg Score</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Attempts</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((assessment) => (
              <>
                <tr key={assessment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <button onClick={() => setExpandedId(expandedId === assessment.id ? null : assessment.id)} className="text-gray-400 hover:text-gray-600">
                      {expandedId === assessment.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                        <ClipboardCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{assessment.title}</p>
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset capitalize mt-0.5', statusBadge[assessment.status])}>
                          {assessment.status}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{assessment.course}</td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{assessment.questionCount}</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">{assessment.passingScore}%</td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn('text-sm font-medium', assessment.avgScore >= assessment.passingScore ? 'text-green-600' : assessment.avgScore > 0 ? 'text-amber-600' : 'text-gray-400')}>
                      {assessment.avgScore > 0 ? `${assessment.avgScore}%` : '--'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">{assessment.attempts > 0 ? assessment.attempts.toLocaleString() : '--'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button onClick={() => setOpenMenu(openMenu === assessment.id ? null : assessment.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenu === assessment.id && (
                        <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            onClick={() => handlePreview(assessment)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-3.5 w-3.5" /> Preview
                          </button>
                          <button
                            onClick={() => openEditModal(assessment)}
                            disabled={!!loadingAction}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Edit className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(assessment)}
                            disabled={!!loadingAction}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === assessment.id && (
                  <tr key={`${assessment.id}-detail`}>
                    <td colSpan={8} className="bg-gray-50/50 px-10 py-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Questions Preview</h4>
                      <div className="space-y-2">
                        {assessment.questions.map((q, i) => {
                          const QIcon = questionTypeIcons[q.type];
                          return (
                            <div key={q.id} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-100">
                              <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', questionTypeBadge[q.type])}>
                                <QIcon className="h-3 w-3" />
                                {q.type.replace('-', ' ')}
                              </span>
                              <p className="flex-1 text-sm text-gray-700">{q.text}</p>
                              <span className="text-xs text-gray-400">{q.points} pts</span>
                            </div>
                          );
                        })}
                        {assessment.questionCount > assessment.questions.length && (
                          <p className="text-xs text-gray-400 text-center py-2">+ {assessment.questionCount - assessment.questions.length} more questions</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <ClipboardCheck className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm font-medium text-gray-500">No assessments found</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {search ? 'Try adjusting your search terms.' : 'Create your first assessment to get started.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Assessment' : 'Create Assessment'}
              </h2>
              <button onClick={closeModal} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Final Compliance Assessment"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this assessment..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
                <select
                  value={form.course_id}
                  onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (min)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.time_limit}
                    onChange={(e) => setForm((f) => ({ ...f, time_limit: Number(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.passing_score}
                    onChange={(e) => setForm((f) => ({ ...f, passing_score: Number(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
                  <input
                    type="number"
                    min={1}
                    value={form.max_attempts}
                    onChange={(e) => setForm((f) => ({ ...f, max_attempts: Number(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFormSubmit}
                disabled={isLoading('create') || isLoading('edit')}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {(isLoading('create') || isLoading('edit')) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Save Changes' : 'Create Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete Assessment</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-medium text-gray-900">{deleteConfirm.title}</span>? All associated questions and attempt data will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isLoading('delete', deleteConfirm.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading('delete', deleteConfirm.id) && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
