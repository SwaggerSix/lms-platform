'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { BookOpen, X } from 'lucide-react';
import {
  enrollmentTypes,
  skillOptions,
  type CourseSettings,
} from './course-new-shared';

interface SettingsStepProps {
  value: CourseSettings;
  onChange: (value: CourseSettings) => void;
}

export default function SettingsStep({ value, onChange }: SettingsStepProps) {
  const [prereqSearch, setPrereqSearch] = useState('');
  const [prereqResults, setPrereqResults] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [prereqSearching, setPrereqSearching] = useState(false);
  const [prereqReqType, setPrereqReqType] = useState<string>('completion');
  const [prereqMinScore, setPrereqMinScore] = useState<number>(70);

  const set = <K extends keyof CourseSettings>(key: K, val: CourseSettings[K]) =>
    onChange({ ...value, [key]: val });

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
            .filter((c: any) => !value.prerequisites.some((p) => p.course_id === c.id))
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
    if (value.prerequisites.some((p) => p.course_id === course.id)) return;
    set('prerequisites', [
      ...value.prerequisites,
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
    set('prerequisites', value.prerequisites.filter((p) => p.course_id !== courseId));
  };

  const updatePrerequisiteType = (courseId: string, reqType: string) => {
    set('prerequisites', value.prerequisites.map((p) =>
      p.course_id === courseId
        ? { ...p, requirement_type: reqType, min_score: reqType === 'min_score' ? (p.min_score ?? 70) : null }
        : p
    ));
  };

  const updatePrerequisiteScore = (courseId: string, score: number) => {
    set('prerequisites', value.prerequisites.map((p) =>
      p.course_id === courseId ? { ...p, min_score: score } : p
    ));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Course Settings</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Enrollment Type</label>
        <div className="flex gap-3">
          {enrollmentTypes.map((et) => (
            <button
              key={et}
              onClick={() => set('enrollmentType', et)}
              aria-pressed={value.enrollmentType === et}
              className={cn(
                'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                value.enrollmentType === et ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              {et}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Passing Score: {value.passingScore}%</label>
        <input type="range" min={0} max={100} value={value.passingScore} onChange={(e) => set('passingScore', parseInt(e.target.value))} className="w-full accent-indigo-600" />
        <div className="flex justify-between text-xs text-gray-400"><span>0%</span><span>100%</span></div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Attempts</label>
        <input type="number" min={1} max={10} value={value.maxAttempts} onChange={(e) => set('maxAttempts', parseInt(e.target.value) || 1)} className="w-32 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={value.includeEvaluation}
            onChange={(e) => set('includeEvaluation', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>
            <span className="block text-sm font-medium text-gray-700">Include a course evaluation</span>
            <span className="block text-xs text-gray-500">When enabled, learners receive a post-completion evaluation. Uncheck to skip evaluations for this course.</span>
          </span>
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Availability</label>
        <p className="text-xs text-gray-500 mb-3">Leave both blank to keep the course live forever. Set a window to license it for a fixed period — outside the window it&apos;s hidden and access is blocked.</p>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Available from</label>
            <input type="date" value={value.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Available until</label>
            <input type="date" value={value.availableUntil} onChange={(e) => set('availableUntil', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
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
        {value.prerequisites.length > 0 && (
          <div className="space-y-2">
            {value.prerequisites.map((prereq) => (
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
        {value.prerequisites.length === 0 && (
          <p className="text-xs text-gray-400 italic">No prerequisites added. This course will be open to all learners.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Skills Mapping</label>
        <div className="flex flex-wrap gap-2">
          {skillOptions.map((s) => (
            <button
              key={s}
              onClick={() => set('skills', value.skills.includes(s) ? value.skills.filter((x) => x !== s) : [...value.skills, s])}
              aria-pressed={value.skills.includes(s)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors border',
                value.skills.includes(s) ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
