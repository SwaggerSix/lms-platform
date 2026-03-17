'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { formatNumber, formatDuration, slugify } from '@/utils/format';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  Plus,
  Route,
  ChevronDown,
  ChevronRight,
  Users,
  Clock,
  BookOpen,
  Edit,
  Trash2,
  GripVertical,
  X,
  Loader2,
  AlertTriangle,
  Search,
} from 'lucide-react';

export interface PathCourse {
  id: string;
  title: string;
  duration: number;
  type: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  courseCount: number;
  enrolled: number;
  status: 'published' | 'draft' | 'archived';
  totalDuration: number;
  courses: PathCourse[];
}

interface AvailableCourse {
  id: string;
  title: string;
  estimated_duration: number | null;
  course_type: string;
}

interface PathFormData {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration: number;
  selectedCourseIds: string[];
  status: 'published' | 'draft' | 'archived';
}

const emptyForm: PathFormData = {
  title: '',
  description: '',
  difficulty: 'beginner',
  estimated_duration: 0,
  selectedCourseIds: [],
  status: 'draft',
};

const statusBadge: Record<string, string> = {
  published: 'bg-green-50 text-green-700 ring-green-600/20',
  draft: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  archived: 'bg-gray-50 text-gray-700 ring-gray-600/20',
};

const difficultyOptions = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const courseTypeMap: Record<string, string> = {
  self_paced: 'Self-Paced',
  instructor_led: 'Instructor-Led',
  blended: 'Blended',
  scorm: 'SCORM',
  external: 'External',
};

export default function PathsClient({ paths: initialPaths }: { paths: LearningPath[] }) {
  const [paths, setPaths] = useState<LearningPath[]>(initialPaths);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);
  const [formData, setFormData] = useState<PathFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Available courses for multi-select
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<LearningPath | null>(null);

  const toast = useToast();

  const fetchAvailableCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await fetch('/api/courses?status=published&limit=100');
      if (res.ok) {
        const data = await res.json();
        setAvailableCourses(data.courses ?? data ?? []);
      }
    } catch {
      // Courses will show as empty
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  // Fetch courses when modal opens
  useEffect(() => {
    if (showModal && availableCourses.length === 0) {
      fetchAvailableCourses();
    }
  }, [showModal, availableCourses.length, fetchAvailableCourses]);

  const openCreateModal = () => {
    setEditingPath(null);
    setFormData(emptyForm);
    setCourseSearch('');
    setShowModal(true);
  };

  const openEditModal = (path: LearningPath) => {
    setEditingPath(path);
    setFormData({
      title: path.title,
      description: path.description,
      difficulty: 'beginner', // default since paths don't store difficulty directly
      estimated_duration: path.totalDuration,
      selectedCourseIds: path.courses.map((c) => c.id),
      status: path.status,
    });
    setCourseSearch('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPath(null);
    setFormData(emptyForm);
    setCourseSearch('');
  };

  const toggleCourse = (courseId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCourseIds: prev.selectedCourseIds.includes(courseId)
        ? prev.selectedCourseIds.filter((id) => id !== courseId)
        : [...prev.selectedCourseIds, courseId],
    }));
  };

  const removeCourse = (courseId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCourseIds: prev.selectedCourseIds.filter((id) => id !== courseId),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const items = formData.selectedCourseIds.map((courseId) => ({
        course_id: courseId,
        is_required: true,
      }));

      if (editingPath) {
        // PATCH existing path
        const res = await fetch('/api/paths', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPath.id,
            title: formData.title,
            description: formData.description,
            status: formData.status,
            estimated_duration: formData.estimated_duration || null,
            items,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to update learning path');
          return;
        }

        // Update local state
        const selectedCourses: PathCourse[] = formData.selectedCourseIds.map((cid) => {
          const existing = editingPath.courses.find((c) => c.id === cid);
          if (existing) return existing;
          const avail = availableCourses.find((c) => c.id === cid);
          return {
            id: cid,
            title: avail?.title ?? 'Unknown Course',
            duration: avail?.estimated_duration ?? 0,
            type: courseTypeMap[avail?.course_type ?? ''] ?? 'Self-Paced',
          };
        });

        setPaths((prev) =>
          prev.map((p) =>
            p.id === editingPath.id
              ? {
                  ...p,
                  title: formData.title,
                  description: formData.description,
                  status: formData.status,
                  totalDuration:
                    formData.estimated_duration ||
                    selectedCourses.reduce((sum, c) => sum + c.duration, 0),
                  courseCount: selectedCourses.length,
                  courses: selectedCourses,
                }
              : p
          )
        );

        toast.success('Learning path updated successfully');
      } else {
        // POST new path
        const res = await fetch('/api/paths', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            slug: slugify(formData.title),
            description: formData.description,
            status: formData.status,
            estimated_duration: formData.estimated_duration || null,
            items,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to create learning path');
          return;
        }

        const created = await res.json();

        const selectedCourses: PathCourse[] = formData.selectedCourseIds.map((cid) => {
          const avail = availableCourses.find((c) => c.id === cid);
          return {
            id: cid,
            title: avail?.title ?? 'Unknown Course',
            duration: avail?.estimated_duration ?? 0,
            type: courseTypeMap[avail?.course_type ?? ''] ?? 'Self-Paced',
          };
        });

        setPaths((prev) => [
          {
            id: created.id,
            title: formData.title,
            description: formData.description,
            courseCount: selectedCourses.length,
            enrolled: 0,
            status: formData.status,
            totalDuration:
              formData.estimated_duration ||
              selectedCourses.reduce((sum, c) => sum + c.duration, 0),
            courses: selectedCourses,
          },
          ...prev,
        ]);

        toast.success('Learning path created successfully');
      }

      closeModal();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (path: LearningPath) => {
    setDeleting(path.id);
    try {
      const res = await fetch(`/api/paths?id=${path.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete learning path');
        return;
      }
      setPaths((prev) => prev.filter((p) => p.id !== path.id));
      toast.success('Learning path deleted');
    } catch {
      toast.error('Failed to delete learning path');
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  const filteredAvailableCourses = availableCourses.filter((c) =>
    c.title.toLowerCase().includes(courseSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learning Paths</h1>
          <p className="mt-1 text-sm text-gray-500">{paths.length} learning paths configured</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Path
        </button>
      </div>

      {/* Path Cards */}
      <div className="space-y-4">
        {paths.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <Route className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">No learning paths yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first learning path.</p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Path
            </button>
          </div>
        )}

        {paths.map((path) => (
          <div key={path.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div
              className="flex items-start gap-4 p-6 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => setExpandedId(expandedId === path.id ? null : path.id)}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <Route className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-gray-900">{path.title}</h3>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', statusBadge[path.status])}>
                    {path.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 line-clamp-1">{path.description}</p>
                <div className="mt-3 flex items-center gap-5 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> {path.courseCount} courses</span>
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {formatNumber(path.enrolled)} enrolled</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {formatDuration(path.totalDuration)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(path);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  className={cn(
                    'rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500',
                    deleting === path.id && 'opacity-50 pointer-events-none'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(path);
                  }}
                  disabled={deleting === path.id}
                >
                  {deleting === path.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
                {expandedId === path.id ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            {expandedId === path.id && (
              <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Course Sequence</h4>
                {path.courses.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No courses added to this path yet.</p>
                ) : (
                  <div className="space-y-2">
                    {path.courses.map((course, i) => (
                      <div key={course.id} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-100">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {i + 1}
                        </div>
                        <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{course.title}</p>
                        </div>
                        <span className="text-xs text-gray-400">{course.type}</span>
                        <span className="text-xs text-gray-400">{formatDuration(course.duration)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingPath ? 'Edit Learning Path' : 'Create Learning Path'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g., Frontend Developer Path"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Describe what learners will gain from this path..."
            />
          </div>

          {/* Difficulty + Duration row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as PathFormData['difficulty'] })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {difficultyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (minutes)</label>
              <input
                type="number"
                min={0}
                value={formData.estimated_duration || ''}
                onChange={(e) => setFormData({ ...formData, estimated_duration: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as PathFormData['status'] })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Course Multi-Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Courses ({formData.selectedCourseIds.length} selected)
            </label>

            {/* Selected courses as chips */}
            {formData.selectedCourseIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.selectedCourseIds.map((cid, idx) => {
                  const course = availableCourses.find((c) => c.id === cid);
                  const existingCourse = editingPath?.courses.find((c) => c.id === cid);
                  const label = course?.title ?? existingCourse?.title ?? 'Unknown Course';
                  return (
                    <span
                      key={cid}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      {label}
                      <button
                        type="button"
                        onClick={() => removeCourse(cid)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Course search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Search courses..."
              />
            </div>

            {/* Course list */}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {loadingCourses ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading courses...
                </div>
              ) : filteredAvailableCourses.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  {courseSearch ? 'No courses match your search.' : 'No published courses available.'}
                </div>
              ) : (
                filteredAvailableCourses.map((course) => {
                  const isSelected = formData.selectedCourseIds.includes(course.id);
                  return (
                    <label
                      key={course.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors',
                        isSelected && 'bg-indigo-50/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCourse(course.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {courseTypeMap[course.course_type] ?? course.course_type}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {formatDuration(course.estimated_duration)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={closeModal}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving
              ? editingPath
                ? 'Saving...'
                : 'Creating...'
              : editingPath
                ? 'Save Changes'
                : 'Create Path'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Learning Path"
        size="sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-700">
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm?.title}</span>? This action cannot be undone.
            </p>
            {(deleteConfirm?.enrolled ?? 0) > 0 && (
              <p className="mt-2 text-sm text-amber-600 font-medium">
                Warning: {formatNumber(deleteConfirm!.enrolled)} learners are currently enrolled in this path.
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!!deleting}
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
