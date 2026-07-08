'use client';

import { formatDuration } from '@/utils/format';
import { Send, Sparkles } from 'lucide-react';
import {
  totalCourseDuration,
  totalLessonCount,
  type CourseData,
  type GenerationOptions,
} from './ai-create-shared';

interface PublishStepProps {
  courseData: CourseData;
  category: string;
  options: GenerationOptions;
}

export default function PublishStep({ courseData, category, options }: PublishStepProps) {
  const totalLessons = totalLessonCount(courseData);
  const totalDuration = totalCourseDuration(courseData);

  return (
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
              <p className="text-sm text-gray-700">{options.courseType}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Difficulty</span>
              <p className="text-sm text-gray-700">{options.difficulty}</p>
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
  );
}
