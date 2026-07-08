'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/ui/toast';
import { slugify } from '@/utils/format';
import {
  Sparkles,
  Wand2,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Save,
  Send,
  AlertTriangle,
} from 'lucide-react';
import {
  courseTypeMap,
  difficultyMap,
  totalCourseDuration,
  type CourseData,
  type GenerationOptions,
} from './ai-create-shared';
import DescribeStep from './describe-step';
import CustomizeStep from './customize-step';
import PublishStep from './publish-step';

const steps = [
  { num: 1, label: 'Describe', icon: BrainCircuit },
  { num: 2, label: 'Customize', icon: Wand2 },
  { num: 3, label: 'Publish', icon: Send },
];

export default function AICreateClient({ hasApiKey }: { hasApiKey: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [options, setOptions] = useState<GenerationOptions>({
    difficulty: 'Intermediate',
    duration: '2-4 hours',
    audience: 'Professionals',
    courseType: 'Self-Paced',
  });
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [category, setCategory] = useState('Technical');
  const [submitting, setSubmitting] = useState(false);

  // ---- API Key Warning ----
  if (!hasApiKey) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Anthropic API Key Not Configured</h2>
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

  const handleGenerated = (course: CourseData) => {
    setCourseData(course);
    setCategory(course.suggestedCategory || 'Technical');
    setStep(2);
  };

  const handleRegenerate = () => {
    setStep(1);
    setCourseData(null);
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
        course_type: courseTypeMap[options.courseType] || 'self_paced',
        difficulty_level: difficultyMap[options.difficulty] || 'intermediate',
        estimated_duration: totalCourseDuration(courseData),
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
        {step === 1 && (
          <DescribeStep options={options} onOptionsChange={setOptions} onGenerated={handleGenerated} />
        )}

        {step === 2 && courseData && (
          <CustomizeStep
            courseData={courseData}
            onChange={setCourseData}
            category={category}
            onCategoryChange={setCategory}
            onRegenerate={handleRegenerate}
          />
        )}

        {step === 3 && courseData && (
          <PublishStep courseData={courseData} category={category} options={options} />
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
