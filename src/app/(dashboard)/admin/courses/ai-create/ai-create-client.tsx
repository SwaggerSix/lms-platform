'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/ui/toast';
import { slugify, formatDuration } from '@/utils/format';
import {
  Sparkles,
  Wand2,
  Bot,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  X,
  Check,
  Loader2,
  Save,
  Send,
  Video,
  FileText,
  Headphones,
  BookOpen,
  Image,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertTriangle,
  FileUp,
} from 'lucide-react';

// ---- Types ----

interface LessonData {
  id: string;
  title: string;
  contentType: 'video' | 'document' | 'audio' | 'quiz' | 'interactive';
  duration: number;
  description: string;
  generatedContent?: string;
}

interface ModuleData {
  id: string;
  title: string;
  description: string;
  lessons: LessonData[];
}

interface CourseData {
  title: string;
  description: string;
  shortDescription: string;
  modules: ModuleData[];
  tags: string[];
  suggestedCategory: string;
}

// ---- Constants ----

const steps = [
  { num: 1, label: 'Describe', icon: BrainCircuit },
  { num: 2, label: 'Customize', icon: Wand2 },
  { num: 3, label: 'Publish', icon: Send },
];

const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'];
const durationOptions = ['30 minutes', '1-2 hours', '2-4 hours', '4-8 hours', '8+ hours'];
const audienceOptions = ['Beginners', 'Professionals', 'Managers', 'Students', 'General audience'];
const courseTypeOptions = ['Self-Paced', 'Instructor-Led', 'Blended'];
const categoryOptions = ['Compliance', 'Management', 'Technical', 'Sales', 'Soft Skills', 'Business'];
const contentTypeList = ['video', 'document', 'audio', 'quiz', 'interactive'] as const;

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

// ---- Component ----

export default function AICreateClient({ hasApiKey }: { hasApiKey: boolean }) {
  const router = useRouter();
  const toast = useToast();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 - Input
  const [inputMode, setInputMode] = useState<'topic' | 'paste'>('topic');
  const [topic, setTopic] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [duration, setDuration] = useState('2-4 hours');
  const [audience, setAudience] = useState('Professionals');
  const [courseType, setCourseType] = useState('Self-Paced');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Step 2 - Course data
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState('Technical');
  const [tagInput, setTagInput] = useState('');
  const [improvingDescription, setImprovingDescription] = useState(false);
  const [generatingContent, setGeneratingContent] = useState<string | null>(null);

  // Step 3 - Publishing
  const [submitting, setSubmitting] = useState(false);

  // ---- API Key Warning ----
  if (!hasApiKey) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">OpenAI API Key Not Configured</h2>
          <p className="mt-2 text-sm text-gray-600">
            To use AI course creation, you need to set the <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono">ANTHROPIC_API_KEY</code> environment variable in your server configuration.
          </p>
          <div className="mt-6">
            <a href="/admin/courses" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ChevronLeft className="h-4 w-4" /> Back to Courses
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---- Handlers ----

  const handleGenerate = async () => {
    const input = inputMode === 'topic' ? topic.trim() : sourceMaterial.trim();
    if (!input) {
      setGenerateError(inputMode === 'topic' ? 'Please describe what you want to teach.' : 'Please paste your source material.');
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const body: Record<string, string> = {
        difficulty: difficulty.toLowerCase(),
        estimated_duration: duration,
        target_audience: audience,
        course_type: courseType.toLowerCase().replace('-', '_').replace(' ', '_'),
      };

      if (inputMode === 'topic') {
        body.topic = input;
      } else {
        body.source_material = input;
      }

      const res = await fetch('/api/ai/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate course');
      }

      const data = await res.json();

      const modules: ModuleData[] = (data.modules || []).map((m: any, mi: number) => ({
        id: `m-${mi}-${Date.now()}`,
        title: m.title,
        description: m.description || '',
        lessons: (m.lessons || []).map((l: any, li: number) => ({
          id: `l-${mi}-${li}-${Date.now()}`,
          title: l.title,
          contentType: l.content_type || 'document',
          duration: l.duration || 10,
          description: l.description || '',
        })),
      }));

      setCourseData({
        title: data.title || '',
        description: data.description || '',
        shortDescription: data.short_description || '',
        modules,
        tags: data.tags || [],
        suggestedCategory: data.suggested_category || 'Technical',
      });

      setCategory(data.suggested_category || 'Technical');
      setExpandedModules(new Set(modules.map((m: ModuleData) => m.id)));
      setStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setStep(1);
    setCourseData(null);
  };

  const handleImproveDescription = async () => {
    if (!courseData || !courseData.description.trim()) return;
    setImprovingDescription(true);

    try {
      const res = await fetch('/api/ai/improve-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: courseData.description,
          title: courseData.title,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to improve description');
      }

      const data = await res.json();
      setCourseData({
        ...courseData,
        description: data.description,
        shortDescription: data.short_description,
      });
      toast.success('Description improved successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to improve description');
    } finally {
      setImprovingDescription(false);
    }
  };

  const handleGenerateContent = async (moduleId: string, lessonId: string) => {
    if (!courseData) return;
    const mod = courseData.modules.find((m) => m.id === moduleId);
    const lesson = mod?.lessons.find((l) => l.id === lessonId);
    if (!mod || !lesson) return;

    setGeneratingContent(lessonId);

    try {
      const res = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_title: lesson.title,
          course_context: `Course: ${courseData.title}. Module: ${mod.title}. ${courseData.description}`,
          content_type: lesson.contentType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate content');
      }

      const data = await res.json();

      setCourseData({
        ...courseData,
        modules: courseData.modules.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === lessonId
                    ? { ...l, generatedContent: data.content, duration: data.estimated_duration || l.duration }
                    : l
                ),
              }
            : m
        ),
      });
      toast.success(`Content generated for "${lesson.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setGeneratingContent(null);
    }
  };

  // Module/Lesson editing
  const updateCourseField = (field: keyof CourseData, value: any) => {
    if (!courseData) return;
    setCourseData({ ...courseData, [field]: value });
  };

  const updateModule = (moduleId: string, updates: Partial<ModuleData>) => {
    if (!courseData) return;
    setCourseData({
      ...courseData,
      modules: courseData.modules.map((m) => (m.id === moduleId ? { ...m, ...updates } : m)),
    });
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<LessonData>) => {
    if (!courseData) return;
    setCourseData({
      ...courseData,
      modules: courseData.modules.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, ...updates } : l)) }
          : m
      ),
    });
  };

  const addModule = () => {
    if (!courseData) return;
    const newId = `m-new-${Date.now()}`;
    setCourseData({
      ...courseData,
      modules: [
        ...courseData.modules,
        { id: newId, title: 'New Module', description: '', lessons: [] },
      ],
    });
    setExpandedModules(new Set([...expandedModules, newId]));
  };

  const removeModule = (moduleId: string) => {
    if (!courseData) return;
    setCourseData({
      ...courseData,
      modules: courseData.modules.filter((m) => m.id !== moduleId),
    });
  };

  const moveModule = (moduleId: string, direction: 'up' | 'down') => {
    if (!courseData) return;
    const idx = courseData.modules.findIndex((m) => m.id === moduleId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === courseData.modules.length - 1)) return;
    const newModules = [...courseData.modules];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newModules[idx], newModules[swapIdx]] = [newModules[swapIdx], newModules[idx]];
    setCourseData({ ...courseData, modules: newModules });
  };

  const addLesson = (moduleId: string) => {
    if (!courseData) return;
    setCourseData({
      ...courseData,
      modules: courseData.modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: [
                ...m.lessons,
                {
                  id: `l-new-${Date.now()}`,
                  title: 'New Lesson',
                  contentType: 'document',
                  duration: 10,
                  description: '',
                },
              ],
            }
          : m
      ),
    });
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    if (!courseData) return;
    setCourseData({
      ...courseData,
      modules: courseData.modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      ),
    });
  };

  const addTag = () => {
    if (!courseData || !tagInput.trim()) return;
    if (!courseData.tags.includes(tagInput.trim())) {
      updateCourseField('tags', [...courseData.tags, tagInput.trim()]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    if (!courseData) return;
    updateCourseField('tags', courseData.tags.filter((t) => t !== tag));
  };

  const toggleModuleExpansion = (moduleId: string) => {
    const next = new Set(expandedModules);
    if (next.has(moduleId)) next.delete(moduleId);
    else next.add(moduleId);
    setExpandedModules(next);
  };

  // Publishing
  const handleSubmit = async (status: 'draft' | 'published') => {
    if (!courseData) return;
    setSubmitting(true);

    try {
      const courseSlug = slugify(courseData.title);
      const body: Record<string, unknown> = {
        title: courseData.title,
        slug: courseSlug,
        description: courseData.description,
        short_description: courseData.shortDescription,
        status,
        course_type: courseTypeMap[courseType] || 'self_paced',
        difficulty_level: difficultyMap[difficulty] || 'intermediate',
        estimated_duration: courseData.modules.reduce(
          (acc, m) => acc + m.lessons.reduce((a, l) => a + l.duration, 0),
          0
        ),
        enrollment_type: 'open',
        passing_score: 70,
        max_attempts: 3,
        tags: courseData.tags,
        metadata: {
          category_name: category,
          ai_generated: true,
          modules: courseData.modules.map((m, mi) => ({
            title: m.title,
            description: m.description,
            sequence_order: mi + 1,
            lessons: m.lessons.map((l, li) => ({
              title: l.title,
              content_type: l.contentType,
              duration: l.duration,
              is_required: true,
              sequence_order: li + 1,
            })),
          })),
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(`Error: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Computed values ----
  const totalLessons = courseData?.modules.reduce((acc, m) => acc + m.lessons.length, 0) || 0;
  const totalDuration = courseData?.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + l.duration, 0),
    0
  ) || 0;

  // ---- Render ----
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <a href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to Courses
        </a>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Course Creator</h1>
            <p className="text-sm text-gray-500">Let AI help you build a complete course in minutes</p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    step > s.num
                      ? 'bg-green-500 text-white'
                      : step === s.num
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-400'
                  )}
                >
                  {step > s.num ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className={cn('text-sm font-medium', step >= s.num ? 'text-gray-900' : 'text-gray-400')}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn('mx-4 h-0.5 flex-1', step > s.num ? 'bg-green-500' : 'bg-gray-200')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {/* ===== STEP 1: Describe ===== */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Bot className="h-6 w-6 text-purple-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Describe Your Course</h2>
                <p className="text-sm text-gray-500">Tell us what you want to teach, and AI will create a structured course outline.</p>
              </div>
            </div>

            {/* Input mode toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 w-fit">
              <button
                onClick={() => setInputMode('topic')}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  inputMode === 'topic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <BrainCircuit className="inline h-4 w-4 mr-1.5" />
                Describe Topic
              </button>
              <button
                onClick={() => setInputMode('paste')}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  inputMode === 'paste' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <FileUp className="inline h-4 w-4 mr-1.5" />
                Paste Content
              </button>
            </div>

            {inputMode === 'topic' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">What do you want to teach?</label>
                <textarea
                  rows={4}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. A comprehensive course on React.js for web developers, covering hooks, state management, and building production-ready applications..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Paste your existing content</label>
                <textarea
                  rows={8}
                  value={sourceMaterial}
                  onChange={(e) => setSourceMaterial(e.target.value)}
                  placeholder="Paste text from your documents, PDFs, notes, or any existing material. AI will analyze and structure it into a course..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono text-xs"
                />
                <p className="mt-1 text-xs text-gray-400">Supports up to ~12,000 characters of source material</p>
              </div>
            )}

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty Level</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {difficultyOptions.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {durationOptions.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {audienceOptions.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Type</label>
                <select
                  value={courseType}
                  onChange={(e) => setCourseType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {courseTypeOptions.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {generateError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {generateError}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {generating ? (
                <>
                  <div className="relative flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI is generating your course outline...</span>
                  </div>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Course Outline
                </>
              )}
            </button>

            {generating && (
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-sm text-gray-500">This usually takes 15-30 seconds</p>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 2: Customize ===== */}
        {step === 2 && courseData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wand2 className="h-6 w-6 text-purple-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Review & Customize</h2>
                  <p className="text-sm text-gray-500">
                    {courseData.modules.length} modules, {totalLessons} lessons, {formatDuration(totalDuration)} total
                  </p>
                </div>
              </div>
              <button
                onClick={handleRegenerate}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" /> Regenerate
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Title</label>
              <input
                type="text"
                value={courseData.title}
                onChange={(e) => updateCourseField('title', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <button
                  onClick={handleImproveDescription}
                  disabled={improvingDescription}
                  className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-60 transition-colors"
                >
                  {improvingDescription ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Improve with AI
                </button>
              </div>
              <textarea
                rows={4}
                value={courseData.description}
                onChange={(e) => updateCourseField('description', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Short Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Description</label>
              <input
                type="text"
                value={courseData.shortDescription}
                onChange={(e) => updateCourseField('shortDescription', e.target.value)}
                maxLength={160}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="mt-1 text-xs text-gray-400">{courseData.shortDescription.length}/160</p>
            </div>

            {/* Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {categoryOptions.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add a tag..."
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button onClick={addTag} className="rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {courseData.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="text-purple-400 hover:text-purple-600">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modules */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Modules & Lessons</h3>
                <button
                  onClick={addModule}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Module
                </button>
              </div>

              {courseData.modules.map((mod, mi) => (
                <div key={mod.id} className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                  {/* Module header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveModule(mod.id, 'up')}
                        disabled={mi === 0}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveModule(mod.id, 'down')}
                        disabled={mi === courseData.modules.length - 1}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 text-xs font-bold text-purple-700">
                      {mi + 1}
                    </span>
                    <input
                      type="text"
                      value={mod.title}
                      onChange={(e) => updateModule(mod.id, { title: e.target.value })}
                      className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                    />
                    <button
                      onClick={() => toggleModuleExpansion(mod.id)}
                      className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                    >
                      {expandedModules.has(mod.id) ? (
                        <ChevronRight className="h-4 w-4 rotate-90 transition-transform" />
                      ) : (
                        <ChevronRight className="h-4 w-4 transition-transform" />
                      )}
                    </button>
                    <button
                      onClick={() => removeModule(mod.id)}
                      className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Lessons */}
                  {expandedModules.has(mod.id) && (
                    <div className="p-3 space-y-2">
                      {mod.lessons.map((lesson) => {
                        const LIcon = contentTypeIcon[lesson.contentType] || FileText;
                        const isGeneratingThis = generatingContent === lesson.id;
                        return (
                          <div key={lesson.id} className="rounded-lg bg-white px-4 py-3 border border-gray-100">
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                              <LIcon className="h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                value={lesson.title}
                                onChange={(e) => updateLesson(mod.id, lesson.id, { title: e.target.value })}
                                className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none"
                              />
                              <select
                                value={lesson.contentType}
                                onChange={(e) => updateLesson(mod.id, lesson.id, { contentType: e.target.value as LessonData['contentType'] })}
                                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none"
                              >
                                {contentTypeList.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
                              </select>
                              <input
                                type="number"
                                value={lesson.duration}
                                onChange={(e) => updateLesson(mod.id, lesson.id, { duration: parseInt(e.target.value) || 0 })}
                                className="w-16 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 text-center focus:outline-none"
                              />
                              <span className="text-[10px] text-gray-400">min</span>
                              <button
                                onClick={() => handleGenerateContent(mod.id, lesson.id)}
                                disabled={isGeneratingThis || generatingContent !== null}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
                                title="Generate content for this lesson"
                              >
                                {isGeneratingThis ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                {isGeneratingThis ? 'Generating...' : 'Content'}
                              </button>
                              <button onClick={() => removeLesson(mod.id, lesson.id)} className="text-gray-300 hover:text-red-500">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {lesson.generatedContent && (
                              <div className="mt-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
                                <p className="text-[10px] font-medium text-green-700 flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Content generated
                                </p>
                                <p className="text-[10px] text-green-600 mt-0.5 line-clamp-2">
                                  {lesson.generatedContent.replace(/<[^>]*>/g, '').slice(0, 150)}...
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => addLesson(mod.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-xs font-medium text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Lesson
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== STEP 3: Publish ===== */}
        {step === 3 && courseData && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Send className="h-6 w-6 text-purple-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Final Review</h2>
                <p className="text-sm text-gray-500">Review your AI-generated course and choose how to save it.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Course Details</h3>
                <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                  <div>
                    <span className="text-xs text-gray-500">Title</span>
                    <p className="text-sm font-medium text-gray-900">{courseData.title}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Category</span>
                    <p className="text-sm text-gray-700">{category}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Type</span>
                    <p className="text-sm text-gray-700">{courseType}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Difficulty</span>
                    <p className="text-sm text-gray-700">{difficulty}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Total Duration</span>
                    <p className="text-sm text-gray-700">{formatDuration(totalDuration)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Tags</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {courseData.tags.map((t) => (
                        <span key={t} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Content Structure</h3>
                <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                  <div>
                    <span className="text-xs text-gray-500">Modules</span>
                    <p className="text-sm font-medium text-gray-900">{courseData.modules.length}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Total Lessons</span>
                    <p className="text-sm text-gray-900">{totalLessons}</p>
                  </div>
                  {courseData.modules.map((m) => (
                    <div key={m.id} className="border-t border-gray-200 pt-2">
                      <p className="text-xs font-medium text-gray-700">{m.title}</p>
                      <p className="text-xs text-gray-500">{m.lessons.length} lessons</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700">AI Generated</span>
                  </div>
                  <p className="text-xs text-purple-600">
                    This course was generated with AI assistance. All content can be further edited after creation.
                  </p>
                </div>
              </div>
            </div>

            {/* Description preview */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Description</h3>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{courseData.description}</p>
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
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <div className="flex gap-3">
          {step === 3 && (
            <>
              <button
                onClick={() => handleSubmit('draft')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save as Draft
              </button>
              <button
                onClick={() => handleSubmit('published')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:from-purple-700 hover:to-indigo-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish Course
              </button>
            </>
          )}
          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={!courseData || courseData.modules.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:from-purple-700 hover:to-indigo-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Publish <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
