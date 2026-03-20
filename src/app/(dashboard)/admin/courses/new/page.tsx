'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useToast } from "@/components/ui/toast";
import { slugify, formatDuration } from '@/utils/format';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  Upload,
  X,
  Video,
  FileText,
  Headphones,
  Image,
  Save,
  Send,
  BookOpen,
  Sparkles,
} from 'lucide-react';

type Lesson = {
  id: string;
  title: string;
  contentType: 'video' | 'document' | 'audio' | 'quiz' | 'interactive';
  duration: number;
  required: boolean;
};

type DripType = 'immediate' | 'after_days' | 'on_date' | 'after_previous';

type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
  dripType: DripType;
  dripDays: number;
  dripDate: string;
};

const steps = [
  { num: 1, label: 'Basic Info' },
  { num: 2, label: 'Content' },
  { num: 3, label: 'Settings' },
  { num: 4, label: 'Review' },
];

const categoryOptions = ['Compliance', 'Management', 'Technical', 'Sales', 'Soft Skills', 'Business'];
const typeOptions = ['Self-Paced', 'Instructor-Led', 'Blended'];
const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'];
const contentTypeOptions = ['video', 'document', 'audio', 'quiz', 'interactive'];
const enrollmentTypes = ['Open', 'Approval Required', 'Assigned Only'];
const requirementTypeLabels: Record<string, string> = {
  completion: 'Completion',
  min_score: 'Minimum Score',
  enrollment: 'Enrollment Only',
};
const skillOptions = ['JavaScript', 'Python', 'React', 'SQL', 'Communication', 'Leadership', 'Problem Solving', 'Project Management', 'Data Analysis'];

const dripTypeLabels: Record<DripType, string> = {
  immediate: 'Immediate',
  after_days: 'Days After Enrollment',
  on_date: 'On Specific Date',
  after_previous: 'After Previous Module',
};

const initialModules: Module[] = [
  {
    id: 'm1',
    title: 'Getting Started',
    dripType: 'immediate',
    dripDays: 0,
    dripDate: '',
    lessons: [
      { id: 'l1', title: 'Welcome & Course Overview', contentType: 'video', duration: 10, required: true },
      { id: 'l2', title: 'Setting Up Your Environment', contentType: 'document', duration: 15, required: true },
      { id: 'l3', title: 'Quick Start Exercise', contentType: 'interactive', duration: 20, required: false },
    ],
  },
  {
    id: 'm2',
    title: 'Core Concepts',
    dripType: 'immediate',
    dripDays: 0,
    dripDate: '',
    lessons: [
      { id: 'l4', title: 'Understanding the Fundamentals', contentType: 'video', duration: 25, required: true },
      { id: 'l5', title: 'Deep Dive: Key Principles', contentType: 'document', duration: 30, required: true },
      { id: 'l6', title: 'Module Quiz', contentType: 'quiz', duration: 15, required: true },
    ],
  },
];

const contentTypeIcon: Record<string, typeof Video> = {
  video: Video,
  document: FileText,
  audio: Headphones,
  quiz: BookOpen,
  interactive: Image,
};

const courseTypeMap: Record<string, string> = {
  'Self-Paced': 'self_paced',
  'Instructor-Led': 'instructor_led',
  'Blended': 'blended',
};

const difficultyMap: Record<string, string> = {
  'Beginner': 'beginner',
  'Intermediate': 'intermediate',
  'Advanced': 'advanced',
};

const enrollmentTypeMap: Record<string, string> = {
  'Open': 'open',
  'Approval Required': 'approval',
  'Assigned Only': 'assigned',
};

export default function CreateCoursePage() {
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [category, setCategory] = useState('Compliance');
  const [courseType, setCourseType] = useState('Self-Paced');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [duration, setDuration] = useState(120);
  const [tags, setTags] = useState<string[]>(['compliance', 'required']);
  const [tagInput, setTagInput] = useState('');
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [enrollmentType, setEnrollmentType] = useState('Open');
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [prerequisites, setPrerequisites] = useState<
    { course_id: string; title: string; requirement_type: string; min_score: number | null }[]
  >([]);
  const [prereqSearch, setPrereqSearch] = useState('');
  const [prereqResults, setPrereqResults] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [prereqSearching, setPrereqSearching] = useState(false);
  const [prereqReqType, setPrereqReqType] = useState<string>('completion');
  const [prereqMinScore, setPrereqMinScore] = useState<number>(70);
  const [skills, setSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (status: 'draft' | 'published') => {
    setSubmitting(true);
    try {
      const finalSlug = slug || slugify(title);
      const body: Record<string, unknown> = {
        title,
        slug: finalSlug,
        description,
        short_description: shortDescription,
        status,
        course_type: courseTypeMap[courseType] || 'self_paced',
        difficulty_level: difficultyMap[difficulty] || 'beginner',
        estimated_duration: duration,
        enrollment_type: enrollmentTypeMap[enrollmentType] || 'open',
        passing_score: passingScore,
        max_attempts: maxAttempts,
        tags,
        metadata: {
          category_name: category,
          modules: modules.map((m, mi) => ({
            title: m.title,
            sequence_order: mi + 1,
            drip_type: m.dripType || 'immediate',
            drip_days: m.dripDays || 0,
            drip_date: m.dripDate || null,
            lessons: m.lessons.map((l, li) => ({
              title: l.title,
              content_type: l.contentType,
              duration: l.duration,
              is_required: l.required,
              sequence_order: li + 1,
            })),
          })),
          prerequisites: prerequisites.map((p) => ({
            course_id: p.course_id,
            requirement_type: p.requirement_type,
            min_score: p.min_score,
          })),
          skills,
        },
        published_at: status === 'published' ? new Date().toISOString() : null,
      };

      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create course');
      }

      toast.success(status === 'published' ? 'Course published successfully!' : 'Draft saved successfully!');
      router.push('/admin/courses');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(`Error: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSlug(slugify(val));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const addModule = () => {
    setModules([...modules, { id: `m${Date.now()}`, title: 'New Module', lessons: [], dripType: 'immediate', dripDays: 0, dripDate: '' }]);
  };

  const addLesson = (moduleId: string) => {
    setModules(modules.map((m) =>
      m.id === moduleId
        ? { ...m, lessons: [...m.lessons, { id: `l${Date.now()}`, title: 'New Lesson', contentType: 'video', duration: 10, required: false }] }
        : m
    ));
  };

  const removeModule = (moduleId: string) => {
    setModules(modules.filter((m) => m.id !== moduleId));
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    setModules(modules.map((m) =>
      m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
    ));
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setModules(modules.map((m) => m.id === moduleId ? { ...m, ...updates } : m));
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setModules(modules.map((m) =>
      m.id === moduleId
        ? { ...m, lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, ...updates } : l) }
        : m
    ));
  };

  const searchPrerequisites = async (query: string) => {
    setPrereqSearch(query);
    if (query.length < 2) {
      setPrereqResults([]);
      return;
    }
    setPrereqSearching(true);
    try {
      const res = await fetch(`/api/courses?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const courses = Array.isArray(data) ? data : data.courses || [];
        setPrereqResults(
          courses
            .filter((c: any) => !prerequisites.some((p) => p.course_id === c.id))
            .map((c: any) => ({ id: c.id, title: c.title, slug: c.slug }))
            .slice(0, 5)
        );
      }
    } catch {
      // Ignore search errors
    } finally {
      setPrereqSearching(false);
    }
  };

  const addPrerequisite = (course: { id: string; title: string }) => {
    if (prerequisites.some((p) => p.course_id === course.id)) return;
    setPrerequisites([
      ...prerequisites,
      {
        course_id: course.id,
        title: course.title,
        requirement_type: prereqReqType,
        min_score: prereqReqType === 'min_score' ? prereqMinScore : null,
      },
    ]);
    setPrereqSearch('');
    setPrereqResults([]);
  };

  const removePrerequisite = (courseId: string) => {
    setPrerequisites(prerequisites.filter((p) => p.course_id !== courseId));
  };

  const updatePrerequisiteType = (courseId: string, reqType: string) => {
    setPrerequisites(prerequisites.map((p) =>
      p.course_id === courseId
        ? { ...p, requirement_type: reqType, min_score: reqType === 'min_score' ? (p.min_score ?? 70) : null }
        : p
    ));
  };

  const updatePrerequisiteScore = (courseId: string, score: number) => {
    setPrerequisites(prerequisites.map((p) =>
      p.course_id === courseId ? { ...p, min_score: score } : p
    ));
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalDuration = modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + l.duration, 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <a href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to Courses
        </a>
        <h1 className="text-2xl font-bold text-gray-900">Create New Course</h1>
      </div>

      {/* AI Assist Banner */}
      <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Want AI to help?</p>
              <p className="text-xs text-gray-500">Let AI generate a complete course structure from a topic or existing materials.</p>
            </div>
          </div>
          <a
            href="/admin/courses/ai-create"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Create with AI
          </a>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  step > s.num
                    ? 'bg-green-500 text-white'
                    : step === s.num
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                )}
              >
                {step > s.num ? <Check className="h-5 w-5" /> : s.num}
              </div>
              <span className={cn('text-sm font-medium', step >= s.num ? 'text-gray-900' : 'text-gray-400')}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('mx-4 h-0.5 flex-1', step > s.num ? 'bg-green-500' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Title</label>
              <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="e.g. Introduction to Data Science" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">/courses/</span>
                <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed course description..." className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Description</label>
              <input type="text" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Brief summary (max 160 characters)" maxLength={160} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  {categoryOptions.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Type</label>
                <select value={courseType} onChange={(e) => setCourseType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  {typeOptions.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty Level</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  {difficultyOptions.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Duration (minutes)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} className="w-32 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <span className="ml-2 text-sm text-gray-400">({formatDuration(duration)})</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Thumbnail</label>
              <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400">PNG, JPG, GIF up to 5MB</p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                    {tag}
                    <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-indigo-400 hover:text-indigo-600"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add a tag..." className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <button onClick={addTag} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
                <p className="text-sm text-gray-500">{modules.length} modules, {totalLessons} lessons, {formatDuration(totalDuration)} total</p>
              </div>
              <button onClick={addModule} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                <Plus className="h-4 w-4" /> Add Module
              </button>
            </div>

            <div className="space-y-4">
              {modules.map((mod, mi) => (
                <div key={mod.id} className="rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl">
                    <GripVertical className="h-4 w-4 text-gray-300 cursor-grab" />
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700">{mi + 1}</span>
                    <input
                      type="text"
                      value={mod.title}
                      onChange={(e) => updateModule(mod.id, { title: e.target.value })}
                      className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                    />
                    <button onClick={() => removeModule(mod.id)} className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Drip / Scheduled Release Settings */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-indigo-50/50">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs font-medium text-gray-600">Release:</label>
                      <select
                        value={mod.dripType}
                        onChange={(e) => updateModule(mod.id, { dripType: e.target.value as DripType })}
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {(Object.keys(dripTypeLabels) as DripType[]).map((dt) => (
                          <option key={dt} value={dt}>{dripTypeLabels[dt]}</option>
                        ))}
                      </select>
                      {mod.dripType === 'after_days' && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={mod.dripDays}
                            onChange={(e) => updateModule(mod.id, { dripDays: parseInt(e.target.value) || 0 })}
                            className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-center text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-gray-500">days after enrollment</span>
                        </div>
                      )}
                      {mod.dripType === 'on_date' && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={mod.dripDate}
                            onChange={(e) => updateModule(mod.id, { dripDate: e.target.value })}
                            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                      {mod.dripType === 'after_previous' && mi === 0 && (
                        <span className="text-xs text-amber-600">First module is always available immediately</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {mod.lessons.map((lesson, li) => {
                      const LIcon = contentTypeIcon[lesson.contentType] || FileText;
                      return (
                        <div key={lesson.id} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-100">
                          <GripVertical className="h-3.5 w-3.5 text-gray-300 cursor-grab" />
                          <LIcon className="h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={lesson.title}
                            onChange={(e) => updateLesson(mod.id, lesson.id, { title: e.target.value })}
                            className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none"
                          />
                          <select
                            value={lesson.contentType}
                            onChange={(e) => updateLesson(mod.id, lesson.id, { contentType: e.target.value as Lesson['contentType'] })}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none"
                          >
                            {contentTypeOptions.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
                          </select>
                          <input
                            type="number"
                            value={lesson.duration}
                            onChange={(e) => updateLesson(mod.id, lesson.id, { duration: parseInt(e.target.value) || 0 })}
                            className="w-16 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 text-center focus:outline-none"
                          />
                          <span className="text-[10px] text-gray-400">min</span>
                          <label className="flex items-center gap-1.5 text-xs text-gray-500">
                            <input
                              type="checkbox"
                              checked={lesson.required}
                              onChange={(e) => updateLesson(mod.id, lesson.id, { required: e.target.checked })}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Required
                          </label>
                          <button onClick={() => removeLesson(mod.id, lesson.id)} className="text-gray-300 hover:text-red-500">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button onClick={() => addLesson(mod.id)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-xs font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add Lesson
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Settings */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Course Settings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Enrollment Type</label>
              <div className="flex gap-3">
                {enrollmentTypes.map((et) => (
                  <button
                    key={et}
                    onClick={() => setEnrollmentType(et)}
                    className={cn(
                      'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                      enrollmentType === et ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {et}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Passing Score: {passingScore}%</label>
              <input type="range" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(parseInt(e.target.value))} className="w-full accent-indigo-600" />
              <div className="flex justify-between text-xs text-gray-400"><span>0%</span><span>100%</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Attempts</label>
              <input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)} className="w-32 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Prerequisites</label>
              <p className="text-xs text-gray-500 mb-3">Search for courses to add as prerequisites. Learners must meet these requirements before enrolling.</p>

              {/* Search for courses */}
              <div className="relative mb-3">
                <input
                  type="text"
                  value={prereqSearch}
                  onChange={(e) => searchPrerequisites(e.target.value)}
                  placeholder="Search courses to add as prerequisite..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {prereqResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                    {prereqResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => addPrerequisite(result)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <BookOpen className="h-4 w-4 text-gray-400" />
                        {result.title}
                      </button>
                    ))}
                  </div>
                )}
                {prereqSearching && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                    <p className="text-sm text-gray-500 text-center">Searching...</p>
                  </div>
                )}
              </div>

              {/* Default requirement type for new additions */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-gray-500">Default requirement:</span>
                <select
                  value={prereqReqType}
                  onChange={(e) => setPrereqReqType(e.target.value)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="completion">Completion</option>
                  <option value="min_score">Minimum Score</option>
                  <option value="enrollment">Enrollment Only</option>
                </select>
                {prereqReqType === 'min_score' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={prereqMinScore}
                      onChange={(e) => setPrereqMinScore(parseInt(e.target.value) || 0)}
                      className="w-16 rounded-md border border-gray-200 px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                )}
              </div>

              {/* List of added prerequisites */}
              {prerequisites.length > 0 && (
                <div className="space-y-2">
                  {prerequisites.map((prereq) => (
                    <div
                      key={prereq.course_id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <BookOpen className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-medium text-gray-900">{prereq.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={prereq.requirement_type}
                          onChange={(e) => updatePrerequisiteType(prereq.course_id, e.target.value)}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none"
                        >
                          <option value="completion">Completion</option>
                          <option value="min_score">Min Score</option>
                          <option value="enrollment">Enrollment</option>
                        </select>
                        {prereq.requirement_type === 'min_score' && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={prereq.min_score ?? 70}
                              onChange={(e) => updatePrerequisiteScore(prereq.course_id, parseInt(e.target.value) || 0)}
                              className="w-14 rounded-md border border-gray-200 px-2 py-1 text-xs text-center focus:outline-none"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )}
                        <button
                          onClick={() => removePrerequisite(prereq.course_id)}
                          className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {prerequisites.length === 0 && (
                <p className="text-xs text-gray-400 italic">No prerequisites added. This course will be open to all learners.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Skills Mapping</label>
              <div className="flex flex-wrap gap-2">
                {skillOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors border',
                      skills.includes(s) ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review & Publish</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Basic Info</h3>
                <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                  <div><span className="text-xs text-gray-500">Title</span><p className="text-sm font-medium text-gray-900">{title || 'Untitled Course'}</p></div>
                  <div><span className="text-xs text-gray-500">Slug</span><p className="text-sm text-gray-700">/courses/{slug || '...'}</p></div>
                  <div><span className="text-xs text-gray-500">Category</span><p className="text-sm text-gray-700">{category}</p></div>
                  <div><span className="text-xs text-gray-500">Type</span><p className="text-sm text-gray-700">{courseType}</p></div>
                  <div><span className="text-xs text-gray-500">Difficulty</span><p className="text-sm text-gray-700">{difficulty}</p></div>
                  <div><span className="text-xs text-gray-500">Duration</span><p className="text-sm text-gray-700">{formatDuration(duration)}</p></div>
                  <div><span className="text-xs text-gray-500">Tags</span><div className="flex flex-wrap gap-1 mt-1">{tags.map((t) => <span key={t} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{t}</span>)}</div></div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Content</h3>
                <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                  <div><span className="text-xs text-gray-500">Modules</span><p className="text-sm font-medium text-gray-900">{modules.length}</p></div>
                  <div><span className="text-xs text-gray-500">Total Lessons</span><p className="text-sm text-gray-900">{totalLessons}</p></div>
                  <div><span className="text-xs text-gray-500">Total Duration</span><p className="text-sm text-gray-900">{formatDuration(totalDuration)}</p></div>
                  {modules.map((m) => (
                    <div key={m.id} className="border-t border-gray-200 pt-2">
                      <p className="text-xs font-medium text-gray-700">{m.title}</p>
                      <p className="text-xs text-gray-500">
                        {m.lessons.length} lessons
                        {m.dripType !== 'immediate' && (
                          <span className="ml-2 text-indigo-600">
                            {m.dripType === 'after_days' && `(unlocks ${m.dripDays} days after enrollment)`}
                            {m.dripType === 'on_date' && `(unlocks on ${m.dripDate || 'TBD'})`}
                            {m.dripType === 'after_previous' && '(unlocks after previous module)'}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Settings</h3>
                <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                  <div><span className="text-xs text-gray-500">Enrollment</span><p className="text-sm text-gray-700">{enrollmentType}</p></div>
                  <div><span className="text-xs text-gray-500">Passing Score</span><p className="text-sm text-gray-700">{passingScore}%</p></div>
                  <div><span className="text-xs text-gray-500">Max Attempts</span><p className="text-sm text-gray-700">{maxAttempts}</p></div>
                  {prerequisites.length > 0 && <div><span className="text-xs text-gray-500">Prerequisites</span><div className="flex flex-wrap gap-1 mt-1">{prerequisites.map((p) => <span key={p.course_id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{p.title} ({requirementTypeLabels[p.requirement_type] || p.requirement_type}{p.requirement_type === 'min_score' ? `: ${p.min_score}%` : ''})</span>)}</div></div>}
                  {skills.length > 0 && <div><span className="text-xs text-gray-500">Skills</span><div className="flex flex-wrap gap-1 mt-1">{skills.map((s) => <span key={s} className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">{s}</span>)}</div></div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <div className="flex gap-3">
          {step === 4 && (
            <>
              <button onClick={() => handleSubmit('draft')} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="h-4 w-4" /> {submitting ? 'Saving...' : 'Save as Draft'}
              </button>
              <button onClick={() => handleSubmit('published')} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="h-4 w-4" /> {submitting ? 'Publishing...' : 'Publish'}
              </button>
            </>
          )}
          {step < 4 && (
            <button
              onClick={() => setStep(step + 1)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
