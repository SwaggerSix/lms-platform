'use client';

import { Button } from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { formatDuration } from '@/utils/format';
import { FileText, GripVertical, Plus, Trash2, X } from 'lucide-react';
import {
  contentTypeIcon,
  contentTypeOptions,
  dripTypeLabels,
  totalLessonCount,
  totalModulesDuration,
  type DripType,
  type Lesson,
  type Module,
} from './course-new-shared';

interface ContentStepProps {
  modules: Module[];
  onChange: (modules: Module[]) => void;
}

export default function ContentStep({ modules, onChange }: ContentStepProps) {
  const totalLessons = totalLessonCount(modules);
  const totalDuration = totalModulesDuration(modules);

  const addModule = () => {
    onChange([...modules, { id: `m${Date.now()}`, title: 'New Module', lessons: [], dripType: 'immediate', dripDays: 0, dripDate: '' }]);
  };

  const addLesson = (moduleId: string) => {
    onChange(modules.map((m) =>
      m.id === moduleId
        ? { ...m, lessons: [...m.lessons, { id: `l${Date.now()}`, title: 'New Lesson', contentType: 'video', duration: 10, required: false }] }
        : m
    ));
  };

  // Add a lesson from the top toolbar — appends to the last module (creating
  // one if there are none yet).
  const addLessonTop = () => {
    const newLesson = { id: `l${Date.now()}`, title: 'New Lesson', contentType: 'video', duration: 10, required: false } as Lesson;
    if (modules.length === 0) {
      onChange([{ id: `m${Date.now()}`, title: 'New Module', lessons: [newLesson], dripType: 'immediate', dripDays: 0, dripDate: '' }]);
    } else {
      onChange(modules.map((m, i) => (i === modules.length - 1 ? { ...m, lessons: [...m.lessons, newLesson] } : m)));
    }
  };

  const removeModule = (moduleId: string) => {
    onChange(modules.filter((m) => m.id !== moduleId));
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    onChange(modules.map((m) =>
      m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
    ));
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    onChange(modules.map((m) => m.id === moduleId ? { ...m, ...updates } : m));
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    onChange(modules.map((m) =>
      m.id === moduleId
        ? { ...m, lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, ...updates } : l) }
        : m
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
            <InfoTooltip
              side="bottom"
              label="Content structure definitions"
              content={
                <div className="space-y-1.5 text-left">
                  <p><strong>Module</strong> — a section that groups related lessons. Parameters: title and an optional drip/release schedule.</p>
                  <p><strong>Lesson</strong> — an individual unit of content within a module. Parameters: title, content type (video, document, audio, quiz, interactive), duration (minutes), and whether it&rsquo;s required.</p>
                  <p><strong>Topic</strong> — the subject a lesson covers; use the lesson title and course tags to capture it (there is no separate topic level).</p>
                </div>
              }
            />
          </div>
          <p className="text-sm text-gray-500">{modules.length} module{modules.length === 1 ? '' : 's'}, {totalLessons} lessons, {formatDuration(totalDuration)} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addLessonTop} className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-white px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50">
            <Plus className="h-4 w-4" /> Add Lesson
          </button>
          <Button onClick={addModule}>
            <Plus className="h-4 w-4" /> Add Module
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {modules.map((mod, mi) => (
          <div key={mod.id} className="rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl">
              <GripVertical className="h-4 w-4 text-gray-300 cursor-grab" />
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-100 text-xs font-bold text-primary-700">{mi + 1}</span>
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
            <div className="px-4 py-3 border-b border-gray-200 bg-primary-50/50">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-medium text-gray-600">Release:</label>
                <select
                  value={mod.dripType}
                  onChange={(e) => updateModule(mod.id, { dripType: e.target.value as DripType })}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                      className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-center text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                )}
                {mod.dripType === 'after_previous' && mi === 0 && (
                  <span className="text-xs text-amber-600">First module is always available immediately</span>
                )}
              </div>
            </div>
            <div className="p-3 space-y-2">
              {mod.lessons.map((lesson) => {
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
                    <span className="text-[10px] text-gray-500">min</span>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={lesson.required}
                        onChange={(e) => updateLesson(mod.id, lesson.id, { required: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      Required
                    </label>
                    <button onClick={() => removeLesson(mod.id, lesson.id)} className="text-gray-300 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              <button onClick={() => addLesson(mod.id)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-xs font-medium text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Lesson
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
