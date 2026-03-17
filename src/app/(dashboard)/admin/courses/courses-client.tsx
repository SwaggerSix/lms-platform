'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { formatNumber, formatPercent, formatDuration } from '@/utils/format';
import { useToast } from '@/components/ui/toast';
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Filter,
  MoreHorizontal,
  Edit,
  Copy,
  Archive,
  BarChart3,
  Users,
  Clock,
  BookOpen,
  Video,
  FileText,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';

export interface CourseItem {
  id: string;
  title: string;
  status: 'published' | 'draft' | 'archived';
  type: 'self-paced' | 'instructor-led' | 'blended';
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  enrolled: number;
  completionRate: number;
  duration: number;
  thumbnail: string;
}

const tabs = ['All', 'Published', 'Draft', 'Archived'] as const;
const categories = ['All Categories', 'Compliance', 'Management', 'Technical', 'Sales', 'Soft Skills'];
const types = ['All Types', 'Self-Paced', 'Instructor-Led', 'Blended'];
const difficulties = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];

const statusBadge: Record<string, string> = {
  published: 'bg-green-50 text-green-700 ring-green-600/20',
  draft: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  archived: 'bg-gray-100 text-gray-500 ring-gray-500/20',
};

const typeBadge: Record<string, string> = {
  'self-paced': 'bg-blue-50 text-blue-700',
  'instructor-led': 'bg-purple-50 text-purple-700',
  blended: 'bg-indigo-50 text-indigo-700',
};

const diffBadge: Record<string, string> = {
  beginner: 'text-green-600',
  intermediate: 'text-amber-600',
  advanced: 'text-red-600',
};

export default function CoursesClient({ courses: initialCourses }: { courses: CourseItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [difficultyFilter, setDifficultyFilter] = useState('All Levels');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Action loading states
  const [loadingAction, setLoadingAction] = useState<{ id: string; action: string } | null>(null);

  // Edit modal state
  const [editModal, setEditModal] = useState<CourseItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<CourseItem>>({});

  // Archive confirmation state
  const [archiveConfirm, setArchiveConfirm] = useState<CourseItem | null>(null);

  // --- Action handlers ---

  const handleEdit = useCallback((course: CourseItem) => {
    setOpenMenu(null);
    setEditModal(course);
    setEditForm({ title: course.title, status: course.status, type: course.type, category: course.category, difficulty: course.difficulty });
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editModal) return;
    setLoadingAction({ id: editModal.id, action: 'edit' });
    try {
      const res = await fetch('/api/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editModal.id, ...editForm }),
      });
      if (!res.ok) throw new Error('Failed to update course');
      setCourses((prev) => prev.map((c) => (c.id === editModal.id ? { ...c, ...editForm } as CourseItem : c)));
      setEditModal(null);
      setEditForm({});
    } catch (err) {
      console.error(err);
      toast.error('Failed to update course. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  }, [editModal, editForm]);

  const handleDuplicate = useCallback(async (course: CourseItem) => {
    setOpenMenu(null);
    setLoadingAction({ id: course.id, action: 'duplicate' });
    try {
      const { id, ...rest } = course;
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, title: `${course.title} (Copy)`, status: 'draft' }),
      });
      if (!res.ok) throw new Error('Failed to duplicate course');
      const newCourse = await res.json();
      const mappedCourse: CourseItem = {
        id: newCourse.id,
        title: newCourse.title || `${course.title} (Copy)`,
        status: 'draft',
        type: course.type,
        category: course.category,
        difficulty: course.difficulty,
        enrolled: 0,
        completionRate: 0,
        duration: course.duration,
        thumbnail: course.thumbnail,
      };
      setCourses((prev) => [mappedCourse, ...prev]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to duplicate course. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  }, []);

  const handleArchive = useCallback((course: CourseItem) => {
    setOpenMenu(null);
    setArchiveConfirm(course);
  }, []);

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveConfirm) return;
    setLoadingAction({ id: archiveConfirm.id, action: 'archive' });
    try {
      const res = await fetch('/api/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: archiveConfirm.id, status: 'archived' }),
      });
      if (!res.ok) throw new Error('Failed to archive course');
      setCourses((prev) => prev.map((c) => (c.id === archiveConfirm.id ? { ...c, status: 'archived' as const } : c)));
      setArchiveConfirm(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to archive course. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  }, [archiveConfirm]);

  const isLoading = (id: string, action: string) => loadingAction?.id === id && loadingAction?.action === action;

  const filtered = courses.filter((c) => {
    const matchesTab = activeTab === 'All' || c.status === activeTab.toLowerCase();
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All Categories' || c.category === categoryFilter;
    const matchesType = typeFilter === 'All Types' || c.type === typeFilter.toLowerCase().replace(' ', '-');
    const matchesDiff = difficultyFilter === 'All Levels' || c.difficulty === difficultyFilter.toLowerCase();
    return matchesTab && matchesSearch && matchesCategory && matchesType && matchesDiff;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedCourses = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showStart = (currentPage - 1) * pageSize;
  const showEnd = Math.min(currentPage * pageSize, filtered.length);

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
          <h1 className="text-2xl font-bold text-gray-900">Course Management</h1>
          <p className="mt-1 text-sm text-gray-500">{courses.length} courses total</p>
        </div>
        <a
          href="/admin/courses/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Course
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {tabs.map((tab) => {
          const count = tab === 'All' ? courses.length : courses.filter((c) => c.status === tab.toLowerCase()).length;
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab} <span className="ml-1 text-xs text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={difficultyFilter} onChange={(e) => { setDifficultyFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
          {difficulties.map((d) => <option key={d}>{d}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1">
          <button onClick={() => setViewMode('grid')} aria-label="Grid view" className={cn('rounded-md p-1.5 transition-colors', viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600')}>
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
          <button onClick={() => setViewMode('list')} aria-label="List view" className={cn('rounded-md p-1.5 transition-colors', viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600')}>
            <List className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {paginatedCourses.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <BookOpen className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-500">No courses found</p>
          <p className="mt-1 text-sm text-gray-400">
            {search || categoryFilter !== 'All Categories' || typeFilter !== 'All Types' || difficultyFilter !== 'All Levels'
              ? 'Try adjusting your search or filters.'
              : 'Get started by creating your first course.'}
          </p>
          <a
            href="/admin/courses/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create Course
          </a>
        </div>
      )}

      {/* Grid View */}
      {paginatedCourses.length === 0 ? null : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedCourses.map((course) => (
            <div key={course.id} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className={cn('relative h-36', course.thumbnail)}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-white/50" />
                </div>
                <div className="absolute right-3 top-3 flex gap-1.5">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', statusBadge[course.status])}>
                    {course.status}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', typeBadge[course.type])}>
                    {course.type.replace('-', ' ')}
                  </span>
                  <span className={cn('text-[10px] font-semibold uppercase', diffBadge[course.difficulty])}>
                    {course.difficulty}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2">{course.title}</h3>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {formatNumber(course.enrolled)}</span>
                  <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {formatPercent(course.completionRate)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(course.duration)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${course.completionRate}%`, backgroundColor: course.completionRate === 100 ? '#22c55e' : '#4f46e5' }} />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(course)}
                  disabled={!!loadingAction}
                  className="flex-1 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Edit className="inline h-3 w-3 mr-1" />Edit
                </button>
                <button
                  onClick={() => handleDuplicate(course)}
                  disabled={!!loadingAction}
                  className="flex-1 rounded-md bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading(course.id, 'duplicate') ? <Loader2 className="inline h-3 w-3 mr-1 animate-spin" /> : <Copy className="inline h-3 w-3 mr-1" />}
                  Duplicate
                </button>
                <button
                  onClick={() => handleArchive(course)}
                  disabled={!!loadingAction || course.status === 'archived'}
                  className="rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading(course.id, 'archive') ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Course</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Enrolled</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Completion</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Duration</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCourses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', course.thumbnail)}>
                        <BookOpen className="h-4 w-4 text-white/70" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{course.title}</p>
                        <p className="text-xs text-gray-400">{course.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', statusBadge[course.status])}>{course.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', typeBadge[course.type])}>{course.type.replace('-', ' ')}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatNumber(course.enrolled)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${course.completionRate}%`, backgroundColor: course.completionRate === 100 ? '#22c55e' : '#4f46e5' }} />
                      </div>
                      <span className="text-xs text-gray-500">{formatPercent(course.completionRate)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDuration(course.duration)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button onClick={() => setOpenMenu(openMenu === course.id ? null : course.id)} aria-label="Course actions" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {openMenu === course.id && (
                        <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          <button onClick={() => handleEdit(course)} disabled={!!loadingAction} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"><Edit className="h-3.5 w-3.5" /> Edit</button>
                          <button onClick={() => handleDuplicate(course)} disabled={!!loadingAction} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                            {isLoading(course.id, 'duplicate') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Duplicate
                          </button>
                          <button onClick={() => handleArchive(course)} disabled={!!loadingAction || course.status === 'archived'} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                            {isLoading(course.id, 'archive') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />} Archive
                          </button>
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><BarChart3 className="h-3.5 w-3.5" /> Analytics</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-[fadeIn_150ms_ease-out]" onClick={() => { setEditModal(null); setEditForm({}); }}>
          <div role="dialog" aria-modal="true" aria-label="Edit Course" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl animate-[modalIn_200ms_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Course</h2>
              <button onClick={() => { setEditModal(null); setEditForm({}); }} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close edit course dialog">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-course-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  id="edit-course-title"
                  type="text"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-course-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    id="edit-course-status"
                    value={editForm.status || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as CourseItem['status'] }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-course-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    id="edit-course-type"
                    value={editForm.type || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as CourseItem['type'] }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <option value="self-paced">Self-Paced</option>
                    <option value="instructor-led">Instructor-Led</option>
                    <option value="blended">Blended</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-course-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    id="edit-course-category"
                    value={editForm.category || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    {categories.filter((c) => c !== 'All Categories').map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-course-difficulty" className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    id="edit-course-difficulty"
                    value={editForm.difficulty || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, difficulty: e.target.value as CourseItem['difficulty'] }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => { setEditModal(null); setEditForm({}); }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={isLoading(editModal.id, 'edit')}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading(editModal.id, 'edit') && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-[fadeIn_150ms_ease-out]" onClick={() => setArchiveConfirm(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl animate-[modalIn_200ms_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Archive Course</h3>
                <p className="text-sm text-gray-500">This action can be undone later.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to archive <span className="font-medium text-gray-900">{archiveConfirm.title}</span>? It will no longer be visible to learners.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setArchiveConfirm(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                disabled={isLoading(archiveConfirm.id, 'archive')}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading(archiveConfirm.id, 'archive') && <Loader2 className="h-4 w-4 animate-spin" />}
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            Showing {showStart + 1}-{showEnd} of {filtered.length} courses
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
    </div>
  );
}
