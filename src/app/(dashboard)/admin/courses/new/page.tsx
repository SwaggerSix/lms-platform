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
} from 'lucide-react';

type Lesson = {
  id: string;
  title: string;
  contentType: 'video' | 'document' | 'audio' | 'quiz' | 'interactive';
  duration: number;
  required: boolean;
};

type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
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
const prerequisiteOptions = ['Workplace Safety Fundamentals', 'Data Privacy & GDPR', 'Leadership Essentials', 'Advanced Excel', 'Introduction to Python'];
const skillOptions = ['JavaScript', 'Python', 'React', 'SQL', 'Communication', 'Leadership', 'Problem Solving', 'Project Management', 'Data Analysis'];

const initialModules: Module[] = [
  {
    id: 'm1',
    title: 'Getting Started',
    lessons: [
      { id: 'l1', title: 'Welcome & Course Overview', contentType: 'video', duration: 10, required: true },
      { id: 'l2', title: 'Setting Up Your Environment', contentType: 'document', duration: 15, required: true },
      { id: 'l3', title: 'Quick Start Exercise', contentType: 'interactive', duration: 20, required: false },
    ],
  },
  {
    id: 'm2',
    title: 'Core Concepts',
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
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
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
            lessons: m.lessons.map((l, li) => ({
              title: l.title,
              content_type: l.contentType,
              duration: l.duration,
              is_required: l.required,
              sequence_order: li + 1,
            })),
          })),
          prerequisites,
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
    setModules([...modules, { id: `m${Date.now()}`, title: 'New Module', lessons: [] }]);
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

  const updateModule = (moduleId: string, title: string) => {
    setModules(modules.map((m) => m.id === moduleId ? { ...m, title } : m));
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setModules(modules.map((m) =>
      m.id === moduleId
        ? { ...m, lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, ...updates } : l) }
        : m
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
                      onChange={(e) => updateModule(mod.id, e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                    />
                    <button onClick={() => removeModule(mod.id)} className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
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
              <div className="flex flex-wrap gap-2">
                {prerequisiteOptions.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrerequisites(prerequisites.includes(p) ? prerequisites.filter((x) => x !== p) : [...prerequisites, p])}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors border',
                      prerequisites.includes(p) ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
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
                      <p className="text-xs text-gray-500">{m.lessons.length} lessons</p>
                    </div>
                  ))}
                </div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Settings</h3>
                <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                  <div><span className="text-xs text-gray-500">Enrollment</span><p className="text-sm text-gray-700">{enrollmentType}</p></div>
                  <div><span className="text-xs text-gray-500">Passing Score</span><p className="text-sm text-gray-700">{passingScore}%</p></div>
                  <div><span className="text-xs text-gray-500">Max Attempts</span><p className="text-sm text-gray-700">{maxAttempts}</p></div>
                  {prerequisites.length > 0 && <div><span className="text-xs text-gray-500">Prerequisites</span><div className="flex flex-wrap gap-1 mt-1">{prerequisites.map((p) => <span key={p} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{p}</span>)}</div></div>}
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
