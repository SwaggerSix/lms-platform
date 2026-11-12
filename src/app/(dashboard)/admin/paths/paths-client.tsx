'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { formatNumber, formatDuration, slugify } from '@/utils/format';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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
  UserPlus,
  Mail,
  ImageIcon,
  Upload,
} from 'lucide-react';
import { parseInviteList, MAX_PATH_INVITES } from '@/lib/paths/invite-list';
import { isValidPathImageUrl } from '@/lib/paths/path-image';
import { COVER_IMAGE_TYPES, COVER_IMAGE_MAX_BYTES } from '@/lib/images/upload-rules';
import { PathThumbnail } from '@/components/paths/path-thumbnail';

interface InviteRowResult {
  email: string;
  status: 'invited' | 'added' | 'resent' | 'already' | 'failed';
  reason?: string;
}

interface InviteResponse {
  summary: { invited: number; added: number; resent?: number; already: number; failed: number };
  results: InviteRowResult[];
}

const inviteStatusLabel: Record<InviteRowResult['status'], string> = {
  invited: 'Invited (new account)',
  added: 'Given access',
  resent: 'Re-sent sign-in link',
  already: 'Already had access',
  failed: 'Failed',
};

const inviteStatusClass: Record<InviteRowResult['status'], string> = {
  invited: 'bg-green-50 text-green-700',
  added: 'bg-green-50 text-green-700',
  resent: 'bg-blue-50 text-blue-700',
  already: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-50 text-red-700',
};

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
  thumbnailUrl: string | null;
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

interface AssignableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface PathFormData {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration: number;
  selectedCourseIds: string[];
  status: 'published' | 'draft' | 'archived';
  /** Image URL typed or pasted by the admin (https:// or /site/path). */
  thumbnailUrl: string;
}

const emptyForm: PathFormData = {
  title: '',
  description: '',
  difficulty: 'beginner',
  estimated_duration: 0,
  selectedCourseIds: [],
  status: 'draft',
  thumbnailUrl: '',
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

  // Path image: an uploaded file waits here until the path is saved (a new
  // path has no id to upload against yet).
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');

  // Available courses for multi-select
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<LearningPath | null>(null);

  // Assign learners
  const [assignPath, setAssignPath] = useState<LearningPath | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Invite people (by email)
  const [invitePath, setInvitePath] = useState<LearningPath | null>(null);
  const [inviteText, setInviteText] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResponse | null>(null);
  const [inviteError, setInviteError] = useState('');

  const toast = useToast();

  // Total time is auto-calculated from the durations of the selected courses.
  const totalDuration = formData.selectedCourseIds.reduce((sum, cid) => {
    const avail = availableCourses.find((c) => c.id === cid);
    const existing = editingPath?.courses.find((c) => c.id === cid);
    return sum + (avail?.estimated_duration ?? existing?.duration ?? 0);
  }, 0);

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
    resetImage();
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
      thumbnailUrl: path.thumbnailUrl ?? '',
    });
    setCourseSearch('');
    resetImage();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPath(null);
    setFormData(emptyForm);
    setCourseSearch('');
    resetImage();
  };

  function resetImage() {
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImageError('');
  }

  const onImageFileChosen = (file: File | null) => {
    setImageError('');
    if (!file) return;
    if (!COVER_IMAGE_TYPES.includes(file.type)) {
      setImageError('Use a JPEG, PNG, WebP or GIF image.');
      return;
    }
    if (file.size > COVER_IMAGE_MAX_BYTES) {
      setImageError('Image must be 5MB or smaller.');
      return;
    }
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setImageFile(file);
    setFormData((prev) => ({ ...prev, thumbnailUrl: '' }));
  };

  const removeImage = () => {
    resetImage();
    setFormData((prev) => ({ ...prev, thumbnailUrl: '' }));
  };

  const trimmedImageUrl = formData.thumbnailUrl.trim();
  const imageUrlInvalid = trimmedImageUrl !== '' && !isValidPathImageUrl(trimmedImageUrl);
  const formPreviewUrl = imagePreview ?? (trimmedImageUrl && !imageUrlInvalid ? trimmedImageUrl : null);

  /** Upload the chosen file for a saved path. Returns the stored URL, or null on failure. */
  const uploadImage = async (pathId: string): Promise<string | null> => {
    if (!imageFile) return null;
    const fd = new FormData();
    fd.append('file', imageFile);
    const res = await fetch(`/api/paths/${pathId}/cover`, { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'The path was saved, but the image could not be uploaded');
      return null;
    }
    return data.url as string;
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
    if (imageUrlInvalid) {
      toast.error('Image URL must start with https:// or be a site path starting with /');
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
            estimated_duration: totalDuration,
            // An uploaded file replaces the image after the save; otherwise the
            // typed URL (or '' to clear) is the image.
            ...(imageFile ? {} : { thumbnail_url: trimmedImageUrl }),
            items,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to update learning path');
          return;
        }

        let thumbnailUrl: string | null = imageFile ? editingPath.thumbnailUrl : trimmedImageUrl || null;
        if (imageFile) {
          const uploaded = await uploadImage(editingPath.id);
          if (uploaded) thumbnailUrl = uploaded;
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
                  thumbnailUrl,
                  status: formData.status,
                  totalDuration,
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
            estimated_duration: totalDuration,
            ...(imageFile || !trimmedImageUrl ? {} : { thumbnail_url: trimmedImageUrl }),
            items,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to create learning path');
          return;
        }

        const created = await res.json();
        let thumbnailUrl: string | null = created.thumbnail_url ?? null;
        if (imageFile) {
          const uploaded = await uploadImage(created.id);
          if (uploaded) thumbnailUrl = uploaded;
        }

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
            thumbnailUrl,
            courseCount: selectedCourses.length,
            enrolled: 0,
            status: formData.status,
            totalDuration,
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

  const fetchAssignableUsers = useCallback(async (search: string) => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({ status: 'active', limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssignableUsers(data.users ?? []);
      }
    } catch {
      // Users will show as empty
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch users when the assign modal is open; debounce search changes
  useEffect(() => {
    if (!assignPath) return;
    const t = setTimeout(() => fetchAssignableUsers(userSearch), 250);
    return () => clearTimeout(t);
  }, [assignPath, userSearch, fetchAssignableUsers]);

  const openAssignModal = (path: LearningPath) => {
    setAssignPath(path);
    setSelectedUserIds([]);
    setUserSearch('');
    setAssignableUsers([]);
  };

  const closeAssignModal = () => {
    setAssignPath(null);
    setSelectedUserIds([]);
    setUserSearch('');
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAssign = async () => {
    if (!assignPath || selectedUserIds.length === 0) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/paths/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path_id: assignPath.id, user_ids: selectedUserIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to assign learners');
        return;
      }
      const result = await res.json();
      const count = result.enrolled_count ?? 0;
      const skipped = selectedUserIds.length - count;
      setPaths((prev) =>
        prev.map((p) =>
          p.id === assignPath.id ? { ...p, enrolled: p.enrolled + count } : p
        )
      );
      const plural = (n: number) => (n === 1 ? '' : 's');
      const emails = result.emails as { emailed: number; setup: number; failed: number } | undefined;
      const sentCount = (emails?.emailed ?? 0) + (emails?.setup ?? 0);
      const parts = [`Assigned ${count} learner${plural(count)}`];
      if (skipped > 0) parts.push(`${skipped} already enrolled`);
      if (sentCount > 0) {
        parts.push(
          emails?.setup
            ? `emailed ${sentCount} (${emails.setup} with a link to set their password)`
            : `emailed ${sentCount}`
        );
      }
      toast.success(parts.join(' · '));
      if (emails && emails.failed > 0) {
        toast.error(
          `${emails.failed} email${plural(emails.failed)} didn't send (${(result.not_emailed as string[] | undefined)?.join(', ') ?? ''}). Use Resend invite under Users.`
        );
      }
      closeAssignModal();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setAssigning(false);
    }
  };

  const openInviteModal = (path: LearningPath) => {
    setInvitePath(path);
    setInviteText('');
    setInviteResult(null);
    setInviteError('');
  };

  const closeInviteModal = () => {
    setInvitePath(null);
    setInviteText('');
    setInviteResult(null);
    setInviteError('');
  };

  const invitePreview = parseInviteList(inviteText);

  const handleInvite = async () => {
    if (!invitePath || invitePreview.invitees.length === 0) return;
    setInviting(true);
    setInviteError('');
    try {
      const res = await fetch(`/api/paths/${invitePath.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inviteText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data.error || 'Could not send the invites');
        return;
      }
      const result = data as InviteResponse;
      setInviteResult(result);
      const newlyEnrolled = result.summary.invited + result.summary.added;
      if (newlyEnrolled > 0) {
        setPaths((prev) =>
          prev.map((p) => (p.id === invitePath.id ? { ...p, enrolled: p.enrolled + newlyEnrolled } : p))
        );
      }
    } catch {
      setInviteError('An unexpected error occurred');
    } finally {
      setInviting(false);
    }
  };

  const userLabel = (u: AssignableUser) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    return name || u.email;
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
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Create Path
        </Button>
      </div>

      {/* Path Cards */}
      <div className="space-y-4">
        {paths.length === 0 && (
          <EmptyState
            icon={<Route className="h-10 w-10" aria-hidden="true" />}
            title="No learning paths yet"
            description="Get started by creating your first learning path."
            action={
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4" />
                Create Path
              </Button>
            }
          />
        )}

        {paths.map((path) => (
          <div key={path.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div
              className="flex items-start gap-4 p-6 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => setExpandedId(expandedId === path.id ? null : path.id)}
            >
              <PathThumbnail
                url={path.thumbnailUrl}
                title={path.title}
                className="h-12 w-12 shrink-0 rounded-xl"
                fallbackClassName="flex items-center justify-center bg-primary-100 text-primary-600"
                fallback={<Route className="h-6 w-6" aria-hidden="true" />}
              />
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
                  title={path.status === 'published' ? 'Assign learners' : 'Publish the path to assign learners'}
                  className={cn(
                    'rounded-lg p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600',
                    path.status !== 'published' && 'opacity-40 pointer-events-none'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAssignModal(path);
                  }}
                  disabled={path.status !== 'published'}
                >
                  <UserPlus className="h-4 w-4" />
                </button>
                <button
                  title={path.status === 'published' ? 'Invite people by email' : 'Publish the path to invite people'}
                  aria-label="Invite people"
                  className={cn(
                    'rounded-lg p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600',
                    path.status !== 'published' && 'opacity-40 pointer-events-none'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    openInviteModal(path);
                  }}
                  disabled={path.status !== 'published'}
                >
                  <Mail className="h-4 w-4" />
                </button>
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
                  <p className="text-sm text-gray-500 italic">No courses added to this path yet.</p>
                ) : (
                  <div className="space-y-2">
                    {path.courses.map((course, i) => (
                      <div key={course.id} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-100">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                          {i + 1}
                        </div>
                        <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{course.title}</p>
                        </div>
                        <span className="text-xs text-gray-500">{course.type}</span>
                        <span className="text-xs text-gray-500">{formatDuration(course.duration)}</span>
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Describe what learners will gain from this path..."
            />
          </div>

          {/* Image */}
          <div>
            <label htmlFor="path-image-url" className="block text-sm font-medium text-gray-700 mb-1">Image</label>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 sm:w-48">
                {formPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview of a local blob or typed URL
                  <img
                    src={formPreviewUrl}
                    alt={formData.title ? `${formData.title} image preview` : 'Path image preview'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <ImageIcon className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  id="path-image-url"
                  type="text"
                  inputMode="url"
                  value={imageFile ? '' : formData.thumbnailUrl}
                  disabled={!!imageFile}
                  onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                  aria-invalid={imageUrlInvalid}
                  aria-describedby="path-image-help"
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:bg-gray-50',
                    imageUrlInvalid
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                  )}
                  placeholder={imageFile ? imageFile.name : 'https://… or /images/paths/my-path.jpg'}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-primary-500">
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Upload image
                    <input
                      type="file"
                      accept={COVER_IMAGE_TYPES.join(',')}
                      className="sr-only"
                      onChange={(e) => {
                        onImageFileChosen(e.target.files?.[0] ?? null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {(imageFile || formData.thumbnailUrl) && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>
                <p id="path-image-help" className={cn('text-xs', imageUrlInvalid || imageError ? 'text-red-600' : 'text-gray-500')}>
                  {imageError
                    ? imageError
                    : imageUrlInvalid
                      ? 'Use a URL starting with https:// or a site path starting with /.'
                      : imageFile
                        ? 'Uploads when you save. JPEG, PNG, WebP or GIF, up to 5MB.'
                        : 'Paste a site path like /images/paths/my-path.jpg, or upload a JPEG, PNG, WebP or GIF (up to 5MB). Images hosted on other websites may be blocked by the site\'s security settings, so uploading is safest. Shown as a 16:9 banner.'}
                </p>
              </div>
            </div>
          </div>

          {/* Difficulty + Duration row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as PathFormData['difficulty'] })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {difficultyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Time (auto-calculated)</label>
              <div className="flex h-[38px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>{totalDuration > 0 ? formatDuration(totalDuration) : '—'}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Sum of the {formData.selectedCourseIds.length} selected course
                {formData.selectedCourseIds.length === 1 ? '' : 's'}.
              </p>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as PathFormData['status'] })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-200 text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      {label}
                      <button
                        type="button"
                        onClick={() => removeCourse(cid)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-primary-200 transition-colors"
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
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Search courses..."
              />
            </div>

            {/* Course list */}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {loadingCourses ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading courses...
                </div>
              ) : filteredAvailableCourses.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">
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
                        isSelected && 'bg-primary-50/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCourse(course.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {courseTypeMap[course.course_type] ?? course.course_type}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
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
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <button
            disabled={saving}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
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
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
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

      {/* Assign Learners Modal */}
      <Modal
        isOpen={!!assignPath}
        onClose={closeAssignModal}
        title={assignPath ? `Assign Learners — ${assignPath.title}` : 'Assign Learners'}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Select learners to enroll in this path. They will also be enrolled in all of its courses.
          </p>

          {/* Selected users as chips */}
          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUserIds.map((uid) => {
                const u = assignableUsers.find((x) => x.id === uid);
                return (
                  <span
                    key={uid}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
                  >
                    {u ? userLabel(u) : 'Selected user'}
                    <button
                      type="button"
                      onClick={() => toggleUser(uid)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-primary-200 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* User search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Search by name or email..."
            />
          </div>

          {/* User list */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading users...
              </div>
            ) : assignableUsers.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                {userSearch ? 'No users match your search.' : 'No active users found.'}
              </div>
            ) : (
              assignableUsers.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors',
                      isSelected && 'bg-primary-50/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUser(u.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{userLabel(u)}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button variant="outline" onClick={closeAssignModal}>
            Cancel
          </Button>
          <button
            disabled={assigning || selectedUserIds.length === 0}
            onClick={handleAssign}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
            {assigning
              ? 'Assigning...'
              : `Assign${selectedUserIds.length > 0 ? ` (${selectedUserIds.length})` : ''}`}
          </button>
        </div>
      </Modal>

      {/* Invite People Modal */}
      <Modal
        isOpen={!!invitePath}
        onClose={closeInviteModal}
        title={invitePath ? `Invite people — ${invitePath.title}` : 'Invite people'}
        size="lg"
      >
        {inviteResult ? (
          <div className="space-y-4">
            <div className={cn('grid grid-cols-2 gap-3', inviteResult.summary.resent ? 'sm:grid-cols-5' : 'sm:grid-cols-4')}>
              {[
                { label: 'Invited (new)', value: inviteResult.summary.invited },
                { label: 'Given access', value: inviteResult.summary.added },
                // Only shown when it happened, to keep the usual four tiles.
                ...(inviteResult.summary.resent
                  ? [{ label: 'Re-sent sign-in link', value: inviteResult.summary.resent }]
                  : []),
                { label: 'Already had access', value: inviteResult.summary.already },
                { label: 'Failed', value: inviteResult.summary.failed },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-xl font-semibold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {inviteResult.results.map((r, i) => (
                <li key={`${r.email}-${i}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{r.email}</p>
                    {r.reason && <p className="text-xs text-gray-500">{r.reason}</p>}
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', inviteStatusClass[r.status])}>
                    {inviteStatusLabel[r.status]}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <Button variant="outline" onClick={() => { setInviteResult(null); setInviteText(''); }}>
                Invite more
              </Button>
              <Button onClick={closeInviteModal}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Paste email addresses, one per line or separated by commas. You can add a name, like
              {' '}<span className="font-mono text-gray-700">Jane Doe &lt;jane@example.com&gt;</span>.
              Each person gets this path and all of its courses, plus an email. People without an
              account get one and are asked to set a password.
            </p>
            <label htmlFor="path-invite-emails" className="sr-only">Email addresses</label>
            <textarea
              id="path-invite-emails"
              value={inviteText}
              onChange={(e) => setInviteText(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder={'jane@example.com\nBob Smith <bob@example.com>'}
            />
            <p className="text-xs text-gray-500">
              {invitePreview.invitees.length} email address{invitePreview.invitees.length === 1 ? '' : 'es'} found
              {invitePreview.invalid.length > 0 && ` · ${invitePreview.invalid.length} line${invitePreview.invalid.length === 1 ? '' : 's'} without an address`}
              {invitePreview.invitees.length > MAX_PATH_INVITES && ` · at most ${MAX_PATH_INVITES} at a time`}
            </p>
            {inviteError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{inviteError}</div>
            )}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <Button variant="outline" onClick={closeInviteModal}>
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                loading={inviting}
                disabled={
                  inviting ||
                  invitePreview.invitees.length === 0 ||
                  invitePreview.invitees.length > MAX_PATH_INVITES
                }
              >
                {inviting ? 'Sending...' : `Send${invitePreview.invitees.length > 0 ? ` (${invitePreview.invitees.length})` : ''}`}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
