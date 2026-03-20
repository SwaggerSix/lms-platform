"use client";

import { useState } from "react";

interface ExternalCourse {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string | null;
  external_url: string;
  duration_minutes?: number | null;
  difficulty?: string | null;
  topics?: string[];
  rating?: number | null;
  provider?: {
    id: string;
    name: string;
    provider_type: string;
  } | null;
  user_enrollment?: {
    status: string;
    progress: number;
  } | null;
}

interface ExternalCourseCardProps {
  course: ExternalCourse;
  onEnroll?: (courseId: string) => void;
}

const providerBadgeColors: Record<string, string> = {
  linkedin_learning: "bg-blue-100 text-blue-800",
  coursera: "bg-indigo-100 text-indigo-800",
  udemy_business: "bg-purple-100 text-purple-800",
  openai: "bg-gray-100 text-gray-800",
  custom: "bg-gray-100 text-gray-600",
};

const providerLabels: Record<string, string> = {
  linkedin_learning: "LinkedIn Learning",
  coursera: "Coursera",
  udemy_business: "Udemy Business",
  openai: "OpenAI",
  custom: "External",
};

const difficultyColors: Record<string, string> = {
  beginner: "text-green-600",
  intermediate: "text-yellow-600",
  advanced: "text-red-600",
};

export default function ExternalCourseCard({ course, onEnroll }: ExternalCourseCardProps) {
  const [enrolling, setEnrolling] = useState(false);

  const handleEnroll = async () => {
    if (!onEnroll) return;
    setEnrolling(true);
    try {
      await onEnroll(course.id);
    } finally {
      setEnrolling(false);
    }
  };

  const providerType = course.provider?.provider_type || "custom";

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
        )}

        {/* Provider Badge */}
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${providerBadgeColors[providerType]}`}>
            {course.provider?.name || providerLabels[providerType]}
          </span>
        </div>

        {/* Rating */}
        {course.rating && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
            <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {course.rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 mb-1.5">
          {course.title}
        </h3>

        {course.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{course.description}</p>
        )}

        {/* Meta Row */}
        <div className="flex items-center gap-3 mb-3">
          {course.duration_minutes && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {course.duration_minutes >= 60
                ? `${Math.floor(course.duration_minutes / 60)}h ${course.duration_minutes % 60}m`
                : `${course.duration_minutes}m`}
            </span>
          )}
          {course.difficulty && (
            <span className={`text-xs font-medium ${difficultyColors[course.difficulty] || "text-gray-500"}`}>
              {course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1)}
            </span>
          )}
        </div>

        {/* Topics */}
        {course.topics && course.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {course.topics.slice(0, 3).map((topic) => (
              <span key={topic} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {topic}
              </span>
            ))}
            {course.topics.length > 3 && (
              <span className="text-xs text-gray-400">+{course.topics.length - 3}</span>
            )}
          </div>
        )}

        {/* Enrollment / Progress */}
        {course.user_enrollment ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">
                {course.user_enrollment.status === "completed"
                  ? "Completed"
                  : `${Math.round(course.user_enrollment.progress)}% complete`}
              </span>
              <a
                href={course.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Continue
              </a>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  course.user_enrollment.status === "completed"
                    ? "bg-green-500"
                    : "bg-indigo-600"
                }`}
                style={{ width: `${course.user_enrollment.progress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {enrolling ? "Enrolling..." : "Enroll"}
          </button>
        )}
      </div>
    </div>
  );
}
