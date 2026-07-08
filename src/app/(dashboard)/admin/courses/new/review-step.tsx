'use client';

import { formatDuration } from '@/utils/format';
import {
  requirementTypeLabels,
  totalLessonCount,
  totalModulesDuration,
  type BasicInfo,
  type CourseSettings,
  type Module,
} from './course-new-shared';

interface ReviewStepProps {
  basicInfo: BasicInfo;
  modules: Module[];
  settings: CourseSettings;
  categories: { id: string; name: string }[];
}

export default function ReviewStep({ basicInfo, modules, settings, categories }: ReviewStepProps) {
  const totalLessons = totalLessonCount(modules);
  const totalDuration = totalModulesDuration(modules);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Review & Publish</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Basic Info</h3>
          <div className="rounded-lg bg-gray-50 p-4 space-y-3">
            <div><span className="text-xs text-gray-500">Title</span><p className="text-sm font-medium text-gray-900">{basicInfo.title || 'Untitled Course'}</p></div>
            <div><span className="text-xs text-gray-500">Slug</span><p className="text-sm text-gray-700">/courses/{basicInfo.slug || '...'}</p></div>
            <div><span className="text-xs text-gray-500">Category</span><p className="text-sm text-gray-700">{categories.find((c) => c.id === basicInfo.categoryId)?.name ?? 'Uncategorized'}</p></div>
            <div><span className="text-xs text-gray-500">Type</span><p className="text-sm text-gray-700">{basicInfo.courseType}</p></div>
            <div><span className="text-xs text-gray-500">Difficulty</span><p className="text-sm text-gray-700">{basicInfo.difficulty}</p></div>
            <div><span className="text-xs text-gray-500">Duration</span><p className="text-sm text-gray-700">{formatDuration(basicInfo.duration)}</p></div>
            <div><span className="text-xs text-gray-500">Tags</span><div className="flex flex-wrap gap-1 mt-1">{basicInfo.tags.map((t) => <span key={t} className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">{t}</span>)}</div></div>
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
                    <span className="ml-2 text-primary-600">
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
            <div><span className="text-xs text-gray-500">Enrollment</span><p className="text-sm text-gray-700">{settings.enrollmentType}</p></div>
            <div><span className="text-xs text-gray-500">Passing Score</span><p className="text-sm text-gray-700">{settings.passingScore}%</p></div>
            <div><span className="text-xs text-gray-500">Max Attempts</span><p className="text-sm text-gray-700">{settings.maxAttempts}</p></div>
            {settings.prerequisites.length > 0 && <div><span className="text-xs text-gray-500">Prerequisites</span><div className="flex flex-wrap gap-1 mt-1">{settings.prerequisites.map((p) => <span key={p.course_id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{p.title} ({requirementTypeLabels[p.requirement_type] || p.requirement_type}{p.requirement_type === 'min_score' ? `: ${p.min_score}%` : ''})</span>)}</div></div>}
            {settings.skills.length > 0 && <div><span className="text-xs text-gray-500">Skills</span><div className="flex flex-wrap gap-1 mt-1">{settings.skills.map((s) => <span key={s} className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">{s}</span>)}</div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
