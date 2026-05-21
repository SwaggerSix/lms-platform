'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Sparkles,
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
  courseVersion: string;
  lastReview: string;
  nasbaCpe: boolean;
  cpeCredits: number;
  requiredEnabled: boolean;
  requiredRoles: string[];
  requiredOrgIds: string[];
  requiredDueDays: number;
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

const reviewStatusFilters = ['All Reviews', 'Overdue', 'Due Soon', 'Upcoming', 'Recently Reviewed', 'Not Set'] as const;
type ReviewStatusFilter = typeof reviewStatusFilters[number];

type ReviewStatus = 'overdue' | 'due_soon' | 'upcoming' | 'ok' | 'unset';

function getReviewStatus(lastReview: string): { status: ReviewStatus; daysUntil: number | null; label: string; classes: string } {
  if (!lastReview) {
    return { status: 'unset', daysUntil: null, label: 'No review date', classes: 'bg-gray-100 text-gray-600 ring-gray-500/20' };
  }
  const reviewTime = new Date(lastReview).getTime();
  if (!Number.isFinite(reviewTime)) {
    return { status: 'unset', daysUntil: null, label: 'Invalid date', classes: 'bg-gray-100 text-gray-600 ring-gray-500/20' };
  }
  const dueTime = reviewTime + 365 * 24 * 60 * 60 * 1000;
  const daysUntil = Math.ceil((dueTime - Date.now()) / (24 * 60 * 60 * 1000));

  if (daysUntil < 0) {
    return { status: 'overdue', daysUntil, label: `Overdue ${Math.abs(daysUntil)}d`, classes: 'bg-red-50 text-red-700 ring-red-600/20' };
  }
  if (daysUntil <= 30) {
    return { status: 'due_soon', daysUntil, label: `Due in ${daysUntil}d`, classes: 'bg-amber-50 text-amber-700 ring-amber-600/20' };
  }
  if (daysUntil <= 90) {
    return { status: 'upcoming', daysUntil, label: `Due in ${daysUntil}d`, classes: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' };
  }
  return { status: 'ok', daysUntil, label: `Due in ${daysUntil}d`, classes: 'bg-green-50 text-green-700 ring-green-600/20' };
}

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
  const [reviewFilter, setReviewFilter] = useState<ReviewStatusFilter>('All Reviews');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Action loading states
  const [loadingAction, setLoadingAction] = useState<{ id: string; action: string } | null>(null);

  // Edit modal state
  const [editModal, setEditModal] = useState<CourseItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<CourseItem>>({});
  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!editModal) return;
    if (orgOptions.length > 0) return;
    fetch('/api/organizations')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setOrgOptions(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
        }
      })
      .catch(() => {});
  }, [editModal, orgOptions.length]);

  // Archive confirmation state
  const [archiveConfirm, setArchiveConfirm] = useState<CourseItem | null>(null);

  // --- Action handlers ---

  const handleEdit = useCallback((course: CourseItem) => {
    setOpenMenu(null);
    setEditModal(course);
    setEditForm({
      title: course.title,
      status: course.status,
      type: course.type,
      category: course.category,
      difficulty: course.difficulty,
      courseVersion: course.courseVersion,
      lastReview: course.lastReview,
      nasbaCpe: course.nasbaCpe,
      cpeCredits: course.cpeCredits,
      requiredEnabled: course.requiredEnabled,
      requiredRoles: course.requiredRoles,
      requiredOrgIds: course.requiredOrgIds,
      requiredDueDays: course.requiredDueDays,
    });
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editModal) return;
    setLoadingAction({ id: editModal.id, action: 'edit' });
    try {
      const { courseVersion, lastReview, nasbaCpe, cpeCredits, requiredEnabled, requiredRoles, requiredOrgIds, requiredDueDays, ...rest } = editForm;
      const roles = requiredRoles ?? [];
      const orgIds = requiredOrgIds ?? [];
      const metadata: Record<string, unknown> = {
        course_version: (courseVersion ?? '').toString().trim() || '1.0',
        last_curriculum_review: lastReview ?? '',
        nasba_cpe: !!nasbaCpe,
        cpe_credits: nasbaCpe ? Number(cpeCredits) || 0 : 0,
        required_for: requiredEnabled && (roles.length > 0 || orgIds.length > 0)
          ? {
              roles,
              organization_ids: orgIds,
              due_days: Number(requiredDueDays) > 0 ? Number(requiredDueDays) : undefined,
            }
          : null,
      };
      // If the review date changed, clear sent-alert flags so new alerts
      // can fire against the updated date.
      if (lastReview && lastReview !== editModal.lastReview) {
        metadata.review_alerts_sent = {};
      }
      const res = await fetch('/api/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editModal.id, ...rest, metadata }),
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
        courseVersion: course.courseVersion,
        lastReview: course.lastReview,
        nasbaCpe: course.nasbaCpe,
        cpeCredits: course.cpeCredits,
        requiredEnabled: course.requiredEnabled,
        requiredRoles: course.requiredRoles,
        requiredOrgIds: course.requiredOrgIds,
        requiredDueDays: course.requiredDueDays,
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
    let matchesReview = true;
    if (reviewFilter !== 'All Reviews') {
      const { status } = getReviewStatus(c.lastReview);
      if (reviewFilter === 'Overdue') matchesReview = status === 'overdue';
      else if (reviewFilter === 'Due Soon') matchesReview = status === 'due_soon';
      else if (reviewFilter === 'Upcoming') matchesReview = status === 'upcoming';
      else if (reviewFilter === 'Recently Reviewed') matchesReview = status === 'ok';
      else if (reviewFilter === 'Not Set') matchesReview = status === 'unset';
    }
    return matchesTab && matchesSearch && matchesCategory && matchesType && matchesDiff && matchesReview;
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
          <p className="mt-1 text-sm text-gray-500">
            {courses.length} courses total
            {(() => {
              let overdue = 0;
              let dueSoon = 0;
              for (const c of courses) {
                const s = getReviewStatus(c.lastReview).status;
                if (s === 'overdue') overdue++;
                else if (s === 'due_soon') dueSoon++;
              }
              if (overdue === 0 && dueSoon === 0) return null;
              return (
                <>
                  {overdue > 0 && (
                    <button
                      type="button"
                      onClick={() => { setReviewFilter('Overdue'); setActiveTab('All'); setCurrentPage(1); }}
                      className="ml-3 inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 hover:bg-red-100"
                    >
                      {overdue} overdue review{overdue === 1 ? '' : 's'}
                    </button>
                  )}
                  {dueSoon > 0 && (
                    <button
                      type="button"
                      onClick={() => { setReviewFilter('Due Soon'); setActiveTab('All'); setCurrentPage(1); }}
                      className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 hover:bg-amber-100"
                    >
                      {dueSoon} due soon
                    </button>
                  )}
                </>
              );
            })()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/admin/courses/ai-create"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Create with AI
          </a>
          <a
            href="/admin/courses/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Course
          </a>
        </div>
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
        <select
          value={reviewFilter}
          onChange={(e) => { setReviewFilter(e.target.value as ReviewStatusFilter); setCurrentPage(1); }}
          aria-label="Filter by curriculum review status"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {reviewStatusFilters.map((r) => <option key={r}>{r}</option>)}
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
          {paginatedCourses.map((course) => {
            const review = getReviewStatus(course.lastReview);
            return (
            <div key={course.id} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className={cn('relative h-36', course.thumbnail)}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-white/50" />
                </div>
                <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', statusBadge[course.status])}>
                    {course.status}
                  </span>
                  <span
                    className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset whitespace-nowrap', review.classes)}
                    title={course.lastReview ? `Last review: ${course.lastReview}` : 'No review date recorded'}
                  >
                    Review: {review.label}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', typeBadge[course.type])}>
                    {course.type.replace('-', ' ')}
                  </span>
                  <span className={cn('text-[10px] font-semibold uppercase', diffBadge[course.difficulty])}>
                    {course.difficulty}
                  </span>
                  {course.requiredEnabled && (
                    <span
                      className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200"
                      title={`Required for: ${course.requiredRoles.join(', ') || 'any role'}${course.requiredOrgIds.length > 0 ? ` · ${course.requiredOrgIds.length} org(s)` : ''}`}
                    >
                      REQUIRED
                    </span>
                  )}
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
            );
          })}
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
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Review</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Enrolled</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Completion</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Duration</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCourses.map((course) => {
                const review = getReviewStatus(course.lastReview);
                return (
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
                  <td className="px-6 py-4">
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', review.classes)}
                      title={course.lastReview ? `Last review: ${course.lastReview}` : 'No review date recorded'}
                    >
                      {review.label}
                    </span>
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
                );
              })}
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

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Versioning & Curriculum Review</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-course-version" className="block text-sm font-medium text-gray-700 mb-1">Course Version</label>
                    <input
                      id="edit-course-version"
                      type="text"
                      value={editForm.courseVersion ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, courseVersion: e.target.value }))}
                      placeholder="e.g. 1.0, 2.3"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-course-last-review" className="block text-sm font-medium text-gray-700 mb-1">Last Curriculum Review</label>
                    <input
                      id="edit-course-last-review"
                      type="date"
                      value={editForm.lastReview ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastReview: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Changing this date resets the alert tracker so admins are re-notified 1 month and 2 weeks before the next 1-year mark.</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">NASBA CPE Credits</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editForm.nasbaCpe}
                    onChange={(e) => setEditForm((f) => ({ ...f, nasbaCpe: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">This course offers NASBA CPE credits</span>
                </label>
                {editForm.nasbaCpe && (
                  <div>
                    <label htmlFor="edit-course-cpe-credits" className="block text-sm font-medium text-gray-700 mb-1">CPE Credits Awarded</label>
                    <input
                      id="edit-course-cpe-credits"
                      type="number"
                      min={0}
                      step={0.5}
                      value={editForm.cpeCredits ?? 0}
                      onChange={(e) => setEditForm((f) => ({ ...f, cpeCredits: parseFloat(e.target.value) || 0 }))}
                      className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Required Training</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editForm.requiredEnabled}
                    onChange={(e) => setEditForm((f) => ({ ...f, requiredEnabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Mark this as required training and auto-enrol matching users</span>
                </label>
                {editForm.requiredEnabled && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Required for roles</label>
                      <div className="flex flex-wrap gap-2">
                        {['learner', 'manager', 'instructor', 'admin'].map((r) => {
                          const active = (editForm.requiredRoles ?? []).includes(r);
                          return (
                            <button
                              type="button"
                              key={r}
                              onClick={() => setEditForm((f) => {
                                const current = f.requiredRoles ?? [];
                                return { ...f, requiredRoles: active ? current.filter((x) => x !== r) : [...current, r] };
                              })}
                              className={cn(
                                'rounded-full px-3 py-1 text-xs font-medium capitalize border',
                                active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                              )}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Required for organizations</label>
                      {orgOptions.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No organizations configured yet.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 space-y-1">
                          {orgOptions.map((o) => {
                            const active = (editForm.requiredOrgIds ?? []).includes(o.id);
                            return (
                              <label key={o.id} className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 px-1 py-0.5 hover:bg-gray-50 rounded">
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => setEditForm((f) => {
                                    const current = f.requiredOrgIds ?? [];
                                    return { ...f, requiredOrgIds: active ? current.filter((x) => x !== o.id) : [...current, o.id] };
                                  })}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                {o.name}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Due date offset (days from hire / assignment)</label>
                      <input
                        type="number"
                        min={0}
                        value={editForm.requiredDueDays ?? 0}
                        onChange={(e) => setEditForm((f) => ({ ...f, requiredDueDays: parseInt(e.target.value) || 0 }))}
                        className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-xs text-gray-500">0 = no due date</span>
                    </div>
                    <p className="text-xs text-amber-700">
                      Saving with new criteria will enrol every currently active matching user. Removing the flag does not unenrol existing learners — existing enrolments stay in place.
                    </p>
                  </div>
                )}
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
