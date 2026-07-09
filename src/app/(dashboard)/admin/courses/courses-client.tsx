'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { formatNumber, formatPercent, formatDuration, formatDate } from '@/utils/format';
import { useToast } from '@/components/ui/toast';
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { getHelp } from "@/lib/help-content";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
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
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react';
import { CourseCover } from '@/components/course/course-cover';

export interface CourseItem {
  id: string;
  title: string;
  slug: string;
  status: 'published' | 'draft' | 'archived';
  type: 'self-paced' | 'instructor-led' | 'blended';
  category: string;
  categoryId: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  enrolled: number;
  completionRate: number;
  duration: number;
  /** Fallback gradient classes used when there is no stored cover image. */
  thumbnail: string;
  /** Stored cover image URL (courses.thumbnail_url); null → gradient fallback. */
  coverUrl: string | null;
  /** Availability window for client licensing (ISO strings; null = unbounded). */
  availableFrom: string | null;
  availableUntil: string | null;
  /** Last time the course/courseware was updated (ISO). */
  updatedAt: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
}

const NASBA_EMPTY = {
  nasba_certified: false,
  nasba_cpe_credits: "",
  nasba_field_of_study: "",
  nasba_knowledge_level: "",
  nasba_prerequisites: "",
  nasba_advance_prep: "",
  nasba_delivery_method: "",
};
const NASBA_LEVELS = ["Basic", "Overview", "Intermediate", "Advanced", "Update"];

// The UI uses hyphenated type values; the API/DB expects underscored course_type.
const TYPE_TO_DB: Record<CourseItem['type'], string> = {
  'self-paced': 'self_paced',
  'instructor-led': 'instructor_led',
  blended: 'blended',
};

const tabs = ['All', 'Published', 'Draft', 'Archived'] as const;
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
  blended: 'bg-primary-50 text-primary-700',
};

const diffBadge: Record<string, string> = {
  beginner: 'text-green-600',
  intermediate: 'text-amber-600',
  advanced: 'text-red-600',
};

export default function CoursesClient({ courses: initialCourses, categoryOptions = [] }: { courses: CourseItem[]; categoryOptions?: CategoryOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [difficultyFilter, setDifficultyFilter] = useState('All Levels');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Action loading states
  const [loadingAction, setLoadingAction] = useState<{ id: string; action: string } | null>(null);

  // Edit modal state
  const [editModal, setEditModal] = useState<CourseItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<CourseItem>>({});
  const [nasbaForm, setNasbaForm] = useState(NASBA_EMPTY);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  // Archive confirmation state
  const [archiveConfirm, setArchiveConfirm] = useState<CourseItem | null>(null);

  // --- Action handlers ---

  const handleEdit = useCallback(async (course: CourseItem) => {
    setEditModal(course);
    setEditForm({ title: course.title, status: course.status, type: course.type, categoryId: course.categoryId, difficulty: course.difficulty, availableFrom: course.availableFrom ? course.availableFrom.slice(0, 10) : null, availableUntil: course.availableUntil ? course.availableUntil.slice(0, 10) : null });
    setNasbaForm(NASBA_EMPTY);
    setCoverUrl(null);
    // Load current NASBA values for this course.
    try {
      const res = await fetch(`/api/courses/${course.slug}`);
      if (res.ok) {
        const c = await res.json();
        setNasbaForm({
          nasba_certified: !!c.nasba_certified,
          nasba_cpe_credits: c.nasba_cpe_credits != null ? String(c.nasba_cpe_credits) : "",
          nasba_field_of_study: c.nasba_field_of_study ?? "",
          nasba_knowledge_level: c.nasba_knowledge_level ?? "",
          nasba_prerequisites: c.nasba_prerequisites ?? "",
          nasba_advance_prep: c.nasba_advance_prep ?? "",
          nasba_delivery_method: c.nasba_delivery_method ?? "",
        });
        setCoverUrl(c.thumbnail_url ?? null);
      }
    } catch {
      // Non-fatal: leave NASBA fields blank if the fetch fails.
    }
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editModal) return;
    setLoadingAction({ id: editModal.id, action: 'edit' });
    try {
      // Map the form fields onto the column names the API/DB expect.
      const payload: Record<string, unknown> = { id: editModal.id };
      if (editForm.title !== undefined) payload.title = editForm.title;
      if (editForm.status !== undefined) payload.status = editForm.status;
      if (editForm.type !== undefined) payload.course_type = TYPE_TO_DB[editForm.type];
      if (editForm.difficulty !== undefined) payload.difficulty_level = editForm.difficulty;
      if (editForm.categoryId) payload.category_id = editForm.categoryId;
      // Availability window. Empty = unbounded (null). "from" starts at the
      // beginning of the day; "until" runs through the end of the day.
      if (editForm.availableFrom !== undefined) {
        payload.available_from = editForm.availableFrom
          ? `${editForm.availableFrom}T00:00:00.000Z`
          : null;
      }
      if (editForm.availableUntil !== undefined) {
        payload.available_until = editForm.availableUntil
          ? `${editForm.availableUntil}T23:59:59.999Z`
          : null;
      }

      // NASBA fields
      payload.nasba_certified = nasbaForm.nasba_certified;
      payload.nasba_cpe_credits = nasbaForm.nasba_cpe_credits ? Number(nasbaForm.nasba_cpe_credits) : null;
      payload.nasba_field_of_study = nasbaForm.nasba_field_of_study || null;
      payload.nasba_knowledge_level = nasbaForm.nasba_knowledge_level || null;
      payload.nasba_prerequisites = nasbaForm.nasba_prerequisites || null;
      payload.nasba_advance_prep = nasbaForm.nasba_advance_prep || null;
      payload.nasba_delivery_method = nasbaForm.nasba_delivery_method || null;

      const res = await fetch('/api/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update course');
      const categoryName = categoryOptions.find((c) => c.id === editForm.categoryId)?.name;
      setCourses((prev) =>
        prev.map((c) =>
          c.id === editModal.id
            ? { ...c, ...editForm, category: categoryName ?? c.category, coverUrl } as CourseItem
            : c
        )
      );
      setEditModal(null);
      setEditForm({});
    } catch (err) {
      console.error(err);
      toast.error('Failed to update course. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  }, [editModal, editForm, nasbaForm, categoryOptions]);

  const handleCoverUpload = useCallback(
    async (file: File) => {
      if (!editModal) return;
      setCoverUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/courses/${editModal.slug}/cover`, { method: 'POST', body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed');
        }
        const { url } = await res.json();
        setCoverUrl(url);
        toast.success('Cover image updated');
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Failed to upload cover image');
      } finally {
        setCoverUploading(false);
      }
    },
    [editModal, toast]
  );

  const handleCoverRemove = useCallback(async () => {
    if (!editModal) return;
    setCoverUploading(true);
    try {
      const res = await fetch(`/api/courses/${editModal.slug}/cover`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove cover image');
      setCoverUrl(null);
      toast.success('Cover image removed');
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove cover image');
    } finally {
      setCoverUploading(false);
    }
  }, [editModal, toast]);

  const handleDuplicate = useCallback(async (course: CourseItem) => {
    setLoadingAction({ id: course.id, action: 'duplicate' });
    try {
      // Send only real, correctly-named columns to the API.
      const payload: Record<string, unknown> = {
        title: `${course.title} (Copy)`,
        status: 'draft',
        course_type: TYPE_TO_DB[course.type],
        difficulty_level: course.difficulty,
      };
      if (course.categoryId) payload.category_id = course.categoryId;
      if (course.duration) payload.estimated_duration = course.duration;
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to duplicate course');
      const newCourse = await res.json();
      const mappedCourse: CourseItem = {
        id: newCourse.id,
        title: newCourse.title || `${course.title} (Copy)`,
        slug: newCourse.slug || course.slug,
        status: 'draft',
        type: course.type,
        category: course.category,
        categoryId: course.categoryId,
        difficulty: course.difficulty,
        enrolled: 0,
        completionRate: 0,
        duration: course.duration,
        thumbnail: course.thumbnail,
        coverUrl: course.coverUrl,
        availableFrom: null,
        availableUntil: null,
        updatedAt: new Date().toISOString(),
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

  const courseColumns: DataTableColumn<CourseItem>[] = [
    {
      key: 'course',
      header: 'Course',
      sortValue: (course) => course.title.toLowerCase(),
      render: (course) => (
        <div className="flex items-center gap-3">
          <CourseCover
            thumbnailUrl={course.coverUrl}
            title={course.title}
            gradientClassName={course.thumbnail}
            className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center"
            scrim={false}
          >
            {!course.coverUrl && <BookOpen className="h-4 w-4 text-white/70" />}
          </CourseCover>
          <div>
            <p className="text-sm font-medium text-gray-900">{course.title}</p>
            <p className="text-xs text-gray-500">{course.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (course) => course.status,
      render: (course) => (
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', statusBadge[course.status])}>{course.status}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (course) => course.type,
      render: (course) => (
        <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize', typeBadge[course.type])}>{course.type.replace('-', ' ')}</span>
      ),
    },
    {
      key: 'enrolled',
      header: 'Enrolled',
      sortValue: (course) => course.enrolled,
      render: (course) => <span className="text-sm text-gray-500">{formatNumber(course.enrolled)}</span>,
    },
    {
      key: 'completion',
      header: 'Completion',
      sortValue: (course) => course.completionRate,
      render: (course) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${course.completionRate}%`, backgroundColor: course.completionRate === 100 ? '#22c55e' : 'var(--brand-primary, #91C53C)' }} />
          </div>
          <span className="text-xs text-gray-500">{formatPercent(course.completionRate)}</span>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      sortValue: (course) => course.duration,
      render: (course) => (
        <div className="text-sm text-gray-500">
          <div>{formatDuration(course.duration)}</div>
          {course.updatedAt && (
            <div className="mt-0.5 text-xs text-gray-500">Updated {formatDate(course.updatedAt)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (course) => (
        <RowActionsMenu
          label={`Actions for ${course.title}`}
          actions={[
            { label: 'Edit', icon: <Edit className="h-3.5 w-3.5" />, onSelect: () => handleEdit(course), disabled: !!loadingAction },
            {
              label: 'Duplicate',
              icon: isLoading(course.id, 'duplicate') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />,
              onSelect: () => handleDuplicate(course),
              disabled: !!loadingAction,
            },
            {
              label: 'Archive',
              icon: isLoading(course.id, 'archive') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />,
              onSelect: () => handleArchive(course),
              disabled: !!loadingAction || course.status === 'archived',
            },
            { label: 'Course Content', icon: <FolderOpen className="h-3.5 w-3.5" />, onSelect: () => router.push(`/admin/courses/${course.slug}/resources`) },
            { label: 'One-Pager', icon: <FileText className="h-3.5 w-3.5" />, onSelect: () => router.push(`/admin/courses/${course.slug}/one-pager`) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Course Management</h1>
            <InfoTooltip content={getHelp("admin.courses").details} label="About Course Management" side="bottom" />
          </div>
          <p className="mt-1 text-sm text-gray-500">{courses.length} courses total</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/admin/courses/ai-create"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-primary-700 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Create with AI
          </a>
          <a
            href="/admin/courses/cover-import"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ImageIcon className="h-4 w-4" />
            Bulk images
          </a>
          <a
            href="/admin/courses/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Course
          </a>
        </div>
      </div>

      {/* Tabs */}
      <SegmentedControl
        aria-label="Filter courses by status"
        value={activeTab}
        onChange={(v) => { setActiveTab(v as typeof tabs[number]); setCurrentPage(1); }}
        options={tabs.map((tab) => {
          const count = tab === 'All' ? courses.length : courses.filter((c) => c.status === tab.toLowerCase()).length;
          return {
            value: tab,
            label: (
              <>
                {tab} <span className="ml-1 text-xs text-gray-500">({count})</span>
              </>
            ),
          };
        })}
      />

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          <option>All Categories</option>
          {categoryOptions.map((c) => <option key={c.id}>{c.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={difficultyFilter} onChange={(e) => { setDifficultyFilter(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          {difficulties.map((d) => <option key={d}>{d}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1">
          <button onClick={() => setViewMode('grid')} aria-label="Grid view" className={cn('rounded-md p-1.5 transition-colors', viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600')}>
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
          <button onClick={() => setViewMode('list')} aria-label="List view" className={cn('rounded-md p-1.5 transition-colors', viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600')}>
            <List className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <EmptyState
          icon={<BookOpen className="h-10 w-10" aria-hidden="true" />}
          title="No courses found"
          description={
            search || categoryFilter !== 'All Categories' || typeFilter !== 'All Types' || difficultyFilter !== 'All Levels'
              ? 'Try adjusting your search or filters.'
              : 'Get started by creating your first course.'
          }
          action={
            <a
              href="/admin/courses/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Create Course
            </a>
          }
        />
      )}

      {/* Grid View */}
      {filtered.length === 0 ? null : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedCourses.map((course) => (
            <div key={course.id} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CourseCover
                thumbnailUrl={course.coverUrl}
                title={course.title}
                gradientClassName={course.thumbnail}
                className="h-36"
                scrim={false}
              >
                {!course.coverUrl && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen className="h-10 w-10 text-white/50" />
                  </div>
                )}
                <div className="absolute right-3 top-3 z-10 flex gap-1.5">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize', statusBadge[course.status])}>
                    {course.status}
                  </span>
                </div>
              </CourseCover>
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
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${course.completionRate}%`, backgroundColor: course.completionRate === 100 ? '#22c55e' : 'var(--brand-primary, #91C53C)' }} />
                  </div>
                </div>
                {course.updatedAt && (
                  <p className="mt-2 text-[11px] text-gray-500">Last updated on {formatDate(course.updatedAt)}</p>
                )}
              </div>
              <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(course)}
                  disabled={!!loadingAction}
                  className="flex-1 rounded-md bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
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
        <DataTable
          columns={courseColumns}
          rows={filtered}
          rowKey={(course) => course.id}
          pageSize={12}
          ariaLabel="Courses"
        />
      )}

      {/* Edit Modal */}
      {editModal && (
        <Modal
          isOpen
          onClose={() => { setEditModal(null); setEditForm({}); }}
          title="Edit Course"
          size="md"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => { setEditModal(null); setEditForm({}); }}
              >
                Cancel
              </Button>
              <button
                onClick={handleEditSubmit}
                disabled={isLoading(editModal.id, 'edit')}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading(editModal.id, 'edit') && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-course-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  id="edit-course-title"
                  type="text"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                />
              </div>

              {/* Cover image (licensed). Falls back to generated cover art when empty. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cover image
                  <span className="ml-1 font-normal text-gray-500">(optional — falls back to generated art)</span>
                </label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="Course cover" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <BookOpen className="h-6 w-6" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50',
                        coverUploading && 'pointer-events-none opacity-60'
                      )}
                    >
                      {coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {coverUrl ? 'Replace image' : 'Upload image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={coverUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCoverUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {coverUrl && (
                      <button
                        type="button"
                        onClick={handleCoverRemove}
                        disabled={coverUploading}
                        className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                    <p className="text-xs text-gray-500">JPEG, PNG, WebP, or GIF · up to 5MB</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-course-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    id="edit-course-status"
                    value={editForm.status || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as CourseItem['status'] }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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
                    value={editForm.categoryId || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    <option value="">Uncategorized</option>
                    {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-course-difficulty" className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    id="edit-course-difficulty"
                    value={editForm.difficulty || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, difficulty: e.target.value as CourseItem['difficulty'] }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Availability window (client licensing) */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900">Availability</h3>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!editForm.availableUntil}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        availableUntil: e.target.checked
                          ? null
                          : new Date().toISOString().slice(0, 10),
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Available forever (no end date)
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Uncheck to set a licensing window. Outside this window the course
                  is hidden from learners and access is blocked.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-course-available-from" className="block text-sm font-medium text-gray-700 mb-1">Available from</label>
                    <input
                      id="edit-course-available-from"
                      type="date"
                      value={editForm.availableFrom || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, availableFrom: e.target.value || null }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Blank = available now.</p>
                  </div>
                  {!!editForm.availableUntil && (
                    <div>
                      <label htmlFor="edit-course-available-until" className="block text-sm font-medium text-gray-700 mb-1">Available until</label>
                      <input
                        id="edit-course-available-until"
                        type="date"
                        value={editForm.availableUntil || ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, availableUntil: e.target.value || null }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      />
                      <p className="mt-1 text-xs text-gray-500">Access is cut after this day.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* NASBA CPE certification */}
            <div className="mt-5 rounded-lg border border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={nasbaForm.nasba_certified}
                  onChange={(e) => setNasbaForm({ ...nasbaForm, nasba_certified: e.target.checked })}
                />
                NASBA CPE certified
              </label>
              {nasbaForm.nasba_certified && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">CPE credits</label>
                    <input type="number" min={0} step="0.5" value={nasbaForm.nasba_cpe_credits}
                      onChange={(e) => setNasbaForm({ ...nasbaForm, nasba_cpe_credits: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. 8" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Field of study (NASBA domain)</label>
                    <input value={nasbaForm.nasba_field_of_study}
                      onChange={(e) => setNasbaForm({ ...nasbaForm, nasba_field_of_study: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Accounting" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Knowledge level</label>
                    <select value={nasbaForm.nasba_knowledge_level}
                      onChange={(e) => setNasbaForm({ ...nasbaForm, nasba_knowledge_level: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      <option value="">—</option>
                      {NASBA_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Delivery method</label>
                    <input value={nasbaForm.nasba_delivery_method}
                      onChange={(e) => setNasbaForm({ ...nasbaForm, nasba_delivery_method: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Group Live" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Prerequisites</label>
                    <input value={nasbaForm.nasba_prerequisites}
                      onChange={(e) => setNasbaForm({ ...nasbaForm, nasba_prerequisites: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. None" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Advance preparation</label>
                    <input value={nasbaForm.nasba_advance_prep}
                      onChange={(e) => setNasbaForm({ ...nasbaForm, nasba_advance_prep: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. None" />
                  </div>
                </div>
              )}
            </div>

        </Modal>
      )}

      {/* Archive Confirmation Dialog */}
      <Modal
        isOpen={!!archiveConfirm}
        onClose={() => setArchiveConfirm(null)}
        size="sm"
        footer={
          archiveConfirm && (
            <>
              <Button
                variant="outline"
                onClick={() => setArchiveConfirm(null)}
              >
                Cancel
              </Button>
              <button
                onClick={handleArchiveConfirm}
                disabled={isLoading(archiveConfirm.id, 'archive')}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading(archiveConfirm.id, 'archive') && <Loader2 className="h-4 w-4 animate-spin" />}
                Archive
              </button>
            </>
          )
        }
      >
        {archiveConfirm && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Archive Course</h3>
                <p className="text-sm text-gray-500">This action can be undone later.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to archive <span className="font-medium text-gray-900">{archiveConfirm.title}</span>? It will no longer be visible to learners.
            </p>
          </>
        )}
      </Modal>

      {/* Pagination (grid view; the list view paginates inside DataTable) */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            Showing {showStart + 1}-{showEnd} of {filtered.length} courses
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            {getPageNumbers().map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium',
                  currentPage === p ? 'bg-primary-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                )}
              >
                {p}
              </button>
            ))}
            <Button
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
