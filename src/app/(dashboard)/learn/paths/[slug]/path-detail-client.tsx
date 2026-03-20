"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Award,
  Calendar,
  Target,
  Lock,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDuration, formatDate } from "@/utils/format";

export interface PathCourse {
  id: string;
  sequence: number;
  title: string;
  description: string;
  duration: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  status: "completed" | "in_progress" | "locked";
  progress?: number;
}

export interface PathDetailData {
  id: string;
  slug: string;
  title: string;
  description: string;
  courseCount: number;
  totalDuration: number;
  enrolledCount: number;
  estimatedCompletion: string;
  overallProgress: number;
  gradient: string;
  skills: string[];
  courses: PathCourse[];
}

export interface PathDetailClientProps {
  path: PathDetailData;
  initialEnrolled: boolean;
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    Beginner: "bg-green-100 text-green-700",
    Intermediate: "bg-yellow-100 text-yellow-700",
    Advanced: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", colors[difficulty])}>
      {difficulty}
    </span>
  );
}

export default function PathDetailClient({ path, initialEnrolled }: PathDetailClientProps) {
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [enrolling, setEnrolling] = useState(false);
  const router = useRouter();

  const handleEnroll = useCallback(async () => {
    setEnrolling(true);
    try {
      const res = await fetch("/api/paths/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path_id: path.id }),
      });
      if (res.ok || res.status === 409) {
        setEnrolled(true);
        router.refresh();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setEnrolling(false);
    }
  }, [path.id, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className={cn("bg-gradient-to-r px-6 py-12 text-white", path.gradient)}>
        <div className="mx-auto max-w-7xl">
          <Link
            href="/learn/paths"
            className="mb-4 inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Learning Paths
          </Link>
          <h1 className="text-3xl font-bold md:text-4xl">{path.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/90">{path.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" /> {path.courseCount} courses
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {formatDuration(path.totalDuration)}
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-4 w-4" /> Certificate on completion
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Column - Timeline */}
          <div className="flex-1">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">Course Sequence</h2>
            <div className="relative">
              {path.courses.map((course, index) => {
                const isLast = index === path.courses.length - 1;
                return (
                  <div key={course.id} className="relative flex gap-6 pb-8">
                    {/* Timeline Line */}
                    {!isLast && (
                      <div
                        className={cn(
                          "absolute left-5 top-10 w-0.5",
                          course.status === "completed"
                            ? "bg-green-400"
                            : course.status === "in_progress"
                            ? "bg-indigo-300"
                            : "border-l-2 border-dashed border-gray-300"
                        )}
                        style={{ height: "calc(100% - 2.5rem)" }}
                      />
                    )}

                    {/* Timeline Node */}
                    <div className="relative z-10 shrink-0">
                      {course.status === "completed" ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      ) : course.status === "in_progress" ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white">
                          <span className="text-sm font-bold">{course.sequence}</span>
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100 text-gray-400">
                          <Lock className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Course Card */}
                    <div
                      className={cn(
                        "flex-1 rounded-xl border bg-white p-5 shadow-sm",
                        course.status === "in_progress"
                          ? "border-indigo-200 ring-1 ring-indigo-100"
                          : course.status === "completed"
                          ? "border-green-200"
                          : "border-gray-200"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-400">
                              Course {course.sequence}
                            </span>
                            <DifficultyBadge difficulty={course.difficulty} />
                          </div>
                          <h3 className="mt-1 text-lg font-semibold text-gray-900">
                            {course.title}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">{course.description}</p>
                        </div>
                        <span className="shrink-0 text-sm text-gray-400">
                          {formatDuration(course.duration)}
                        </span>
                      </div>

                      {course.status === "in_progress" && course.progress !== undefined && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Progress</span>
                            <span className="font-medium text-indigo-600">{course.progress}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-indigo-600"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {course.status === "completed" && (
                        <div className="mt-3 flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle2 className="h-4 w-4" /> Completed
                        </div>
                      )}

                      {course.status === "in_progress" && (
                        <Link
                          href={`/learn/player/${course.id}`}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          Continue Learning
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - Enrollment Card */}
          <div className="w-full lg:w-80">
            <div className="sticky top-6 space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                {enrolled ? (
                  <>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Overall Progress</p>
                      <div className="relative mx-auto mt-3 flex h-28 w-28 items-center justify-center">
                        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="8"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="#4f46e5"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 42}`}
                            strokeDashoffset={`${2 * Math.PI * 42 * (1 - path.overallProgress / 100)}`}
                          />
                        </svg>
                        <span className="absolute text-2xl font-bold text-gray-900">
                          {path.overallProgress}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <Target className="h-4 w-4" /> Courses Completed
                        </span>
                        <span className="font-medium text-gray-900">
                          {path.courses.filter((c) => c.status === "completed").length}/{path.courseCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <Calendar className="h-4 w-4" /> Est. Completion
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatDate(path.estimatedCompletion)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEnroll}
                      disabled={enrolling}
                      className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {enrolling ? "Enrolling…" : "Enroll in Path"}
                    </button>
                    <p className="mt-3 text-center text-xs text-gray-500">
                      {path.enrolledCount.toLocaleString()} learners enrolled
                    </p>
                  </>
                )}
              </div>

              {/* Skills Gained */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900">Skills You&apos;ll Gain</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {path.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
