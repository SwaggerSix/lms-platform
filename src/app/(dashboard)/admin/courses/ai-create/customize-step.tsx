'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { formatDuration } from '@/utils/format';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  categoryOptions,
  contentTypeIcon,
  contentTypeList,
  totalCourseDuration,
  totalLessonCount,
  type CourseData,
  type LessonData,
  type ModuleData,
} from './ai-create-shared';

interface CustomizeStepProps {
  courseData: CourseData;
  onChange: (course: CourseData) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  onRegenerate: () => void;
}

export default function CustomizeStep({
  courseData,
  onChange,
  category,
  onCategoryChange,
  onRegenerate,
}: CustomizeStepProps) {
  const toast = useToast();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(courseData.modules.map((m) => m.id))
  );
  const [tagInput, setTagInput] = useState('');
  const [improvingDescription, setImprovingDescription] = useState(false);
  const [generatingContent, setGeneratingContent] = useState<string | null>(null);

  const totalLessons = totalLessonCount(courseData);
  const totalDuration = totalCourseDuration(courseData);

  const handleImproveDescription = async () => {
    if (!courseData.description.trim()) return;
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
      onChange({
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

      onChange({
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
    onChange({ ...courseData, [field]: value });
  };

  const updateModule = (moduleId: string, updates: Partial<ModuleData>) => {
    onChange({
      ...courseData,
      modules: courseData.modules.map((m) => (m.id === moduleId ? { ...m, ...updates } : m)),
    });
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<LessonData>) => {
    onChange({
      ...courseData,
      modules: courseData.modules.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, ...updates } : l)) }
          : m
      ),
    });
  };

  const addModule = () => {
    const newId = `m-new-${Date.now()}`;
    onChange({
      ...courseData,
      modules: [
        ...courseData.modules,
        { id: newId, title: 'New Module', description: '', lessons: [] },
      ],
    });
    setExpandedModules(new Set([...expandedModules, newId]));
  };

  const removeModule = (moduleId: string) => {
    onChange({
      ...courseData,
      modules: courseData.modules.filter((m) => m.id !== moduleId),
    });
  };

  const moveModule = (moduleId: string, direction: 'up' | 'down') => {
    const idx = courseData.modules.findIndex((m) => m.id === moduleId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === courseData.modules.length - 1)) return;
    const newModules = [...courseData.modules];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newModules[idx], newModules[swapIdx]] = [newModules[swapIdx], newModules[idx]];
    onChange({ ...courseData, modules: newModules });
  };

  const addLesson = (moduleId: string) => {
    onChange({
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
    onChange({
      ...courseData,
      modules: courseData.modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      ),
    });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    if (!courseData.tags.includes(tagInput.trim())) {
      updateCourseField('tags', [...courseData.tags, tagInput.trim()]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    updateCourseField('tags', courseData.tags.filter((t) => t !== tag));
  };

  const toggleModuleExpansion = (moduleId: string) => {
    const next = new Set(expandedModules);
    if (next.has(moduleId)) next.delete(moduleId);
    else next.add(moduleId);
    setExpandedModules(next);
  };

  return (
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
          onClick={onRegenerate}
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
        <p className="mt-1 text-xs text-gray-500">{courseData.shortDescription.length}/160</p>
      </div>

      {/* Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
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
                        <span className="text-[10px] text-gray-500">min</span>
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
  );
}
