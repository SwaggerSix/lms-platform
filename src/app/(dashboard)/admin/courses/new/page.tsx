'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { slugify, formatDuration } from '@/utils/format';
import { Check, ChevronLeft, ChevronRight, Save, Send, Sparkles } from 'lucide-react';
import {
  courseTypeMap,
  difficultyMap,
  enrollmentTypeMap,
  initialModules,
  totalModulesDuration,
  type BasicInfo,
  type CourseSettings,
  type Module,
} from './course-new-shared';
import BasicInfoStep from './basic-info-step';
import ContentStep from './content-step';
import SettingsStep from './settings-step';
import ReviewStep from './review-step';

const steps = [
  { num: 1, label: 'Basic Info' },
  { num: 2, label: 'Content' },
  { num: 3, label: 'Settings' },
  { num: 4, label: 'Review' },
];

const ALLOWED_COVER = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function CreateCoursePage() {
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    title: '',
    slug: '',
    description: '',
    shortDescription: '',
    categoryId: '',
    courseType: 'Self-Paced',
    difficulty: 'Beginner',
    duration: 0,
    tags: [],
    learningObjectives: '',
    optimalAudience: '',
  });
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [settings, setSettings] = useState<CourseSettings>({
    enrollmentType: 'Open',
    passingScore: 70,
    maxAttempts: 3,
    includeEvaluation: true,
    availableFrom: '',
    availableUntil: '',
    prerequisites: [],
    skills: [],
  });
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Load real categories so admins pick (and manage) actual category records.
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
  }, []);

  const totalDuration = totalModulesDuration(modules);

  const handleCoverSelect = (file: File | null) => {
    if (!file) return;
    if (!ALLOWED_COVER.includes(file.type)) {
      toast.error('Unsupported image type. Use JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image exceeds 5MB.');
      return;
    }
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setCoverFile(file);
  };

  const handleCoverClear = () => {
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverFile(null);
  };

  const handleSubmit = async (status: 'draft' | 'published') => {
    // Course length (Step 1) must match the sum of lesson durations (Step 2).
    if (basicInfo.duration !== totalDuration) {
      toast.error(
        `Course length (${formatDuration(basicInfo.duration)}) doesn't match the total of your lessons (${formatDuration(totalDuration)}). Use "Match content" or adjust the lessons.`
      );
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      const finalSlug = basicInfo.slug || slugify(basicInfo.title);
      const objectives = basicInfo.learningObjectives
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const body: Record<string, unknown> = {
        title: basicInfo.title,
        slug: finalSlug,
        description: basicInfo.description,
        short_description: basicInfo.shortDescription,
        status,
        course_type: courseTypeMap[basicInfo.courseType] || 'self_paced',
        difficulty_level: difficultyMap[basicInfo.difficulty] || 'beginner',
        estimated_duration: basicInfo.duration,
        enrollment_type: enrollmentTypeMap[settings.enrollmentType] || 'open',
        passing_score: settings.passingScore,
        max_attempts: settings.maxAttempts,
        tags: basicInfo.tags,
        category_id: basicInfo.categoryId || undefined,
        metadata: {
          category_id: basicInfo.categoryId || null,
          learning_outcomes: objectives,
          optimal_audience: basicInfo.optimalAudience || null,
          include_evaluation: settings.includeEvaluation,
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
          prerequisites: settings.prerequisites.map((p) => ({
            course_id: p.course_id,
            requirement_type: p.requirement_type,
            min_score: p.min_score,
          })),
          skills: settings.skills,
        },
        published_at: status === 'published' ? new Date().toISOString() : null,
        available_from: settings.availableFrom ? `${settings.availableFrom}T00:00:00.000Z` : null,
        available_until: settings.availableUntil ? `${settings.availableUntil}T23:59:59.999Z` : null,
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

      const created = await res.json().catch(() => null);
      if (coverFile && created?.slug) {
        try {
          const fd = new FormData();
          fd.append('file', coverFile);
          const coverRes = await fetch(`/api/courses/${created.slug}/cover`, { method: 'POST', body: fd });
          if (!coverRes.ok) throw new Error('cover upload failed');
        } catch {
          toast.error('Course created, but the cover image failed to upload. You can add it later from Edit.');
        }
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
        {step === 1 && (
          <BasicInfoStep
            value={basicInfo}
            onChange={setBasicInfo}
            categories={categories}
            onCategoriesChange={setCategories}
            contentDuration={totalDuration}
            coverPreview={coverPreview}
            onCoverSelect={handleCoverSelect}
            onCoverClear={handleCoverClear}
          />
        )}

        {step === 2 && <ContentStep modules={modules} onChange={setModules} />}

        {step === 3 && <SettingsStep value={settings} onChange={setSettings} />}

        {step === 4 && (
          <ReviewStep
            basicInfo={basicInfo}
            modules={modules}
            settings={settings}
            categories={categories}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="flex gap-3">
          {step === 4 && (
            <>
              <Button variant="outline" onClick={() => handleSubmit('draft')} disabled={submitting}>
                <Save className="h-4 w-4" /> {submitting ? 'Saving...' : 'Save as Draft'}
              </Button>
              <Button onClick={() => handleSubmit('published')} disabled={submitting}>
                <Send className="h-4 w-4" /> {submitting ? 'Publishing...' : 'Publish'}
              </Button>
            </>
          )}
          {step < 4 && (
            <Button onClick={() => setStep(step + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
