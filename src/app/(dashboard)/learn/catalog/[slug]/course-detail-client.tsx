"use client";

import { useState } from "react";
import {
  Star,
  Clock,
  Users,
  BookOpen,
  Award,
  Globe,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  PlayCircle,
  FileText,
  Code,
  HelpCircle,
  ArrowLeft,
  Check,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDuration, formatDate } from "@/utils/format";
import { trackEvent } from "@/lib/analytics/track";

export interface Lesson {
  id: string;
  title: string;
  type: "video" | "document" | "html" | "quiz";
  duration: number;
  completed: boolean;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Review {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  text: string;
}

export interface RelatedCourse {
  slug: string;
  title: string;
  instructor: string;
  gradient: string;
  rating: number;
  duration: number;
}

export interface CourseData {
  id?: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  instructor: {
    name: string;
    avatar: string;
    bio: string;
  };
  difficulty: string;
  type: string;
  duration: number;
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  language: string;
  hasCertificate: boolean;
  gradient: string;
  skills: string[];
  learningOutcomes: string[];
  modules: Module[];
  reviews: Review[];
  relatedCourses: RelatedCourse[];
}

export interface CourseDetailClientProps {
  course: CourseData;
  initialEnrolled: boolean;
}

const lessonIcons = {
  video: PlayCircle,
  document: FileText,
  html: Code,
  quiz: HelpCircle,
};

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            sz,
            s <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          )}
        />
      ))}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    Beginner: "bg-green-100 text-green-700",
    Intermediate: "bg-yellow-100 text-yellow-700",
    Advanced: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", colors[difficulty])}>
      {difficulty}
    </span>
  );
}

export default function CourseDetailClient({ course, initialEnrolled }: CourseDetailClientProps) {
  const [expandedModules, setExpandedModules] = useState<string[]>([course.modules[0]?.id || ""]);
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [showEnrollSuccess, setShowEnrollSuccess] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => l.completed).length,
    0
  );

  const handleEnroll = async () => {
    setEnrolling(true);
    setEnrollError(null);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: course.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Enrollment failed");
      }
      setEnrolled(true);
      setShowEnrollSuccess(true);
      trackEvent("course_enrolled", { course_id: course.id });
      setTimeout(() => setShowEnrollSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Enrollment failed";
      setEnrollError(message);
      setTimeout(() => setEnrollError(null), 5000);
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Toast */}
      {showEnrollSuccess && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-white shadow-lg">
          <CheckCircle2 className="h-5 w-5" />
          Successfully enrolled! Start learning now.
        </div>
      )}
      {/* Error Toast */}
      {enrollError && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-white shadow-lg">
          {enrollError}
        </div>
      )}

      {/* Hero */}
      <div className={cn("bg-gradient-to-r px-6 py-12 text-white", course.gradient)}>
        <div className="mx-auto max-w-7xl">
          <a
            href="/learn/catalog"
            className="mb-4 inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Catalog
          </a>
          <div className="flex flex-wrap items-start gap-3">
            <DifficultyBadge difficulty={course.difficulty} />
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">{course.type}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">{course.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/90">{course.shortDescription}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <span>By <strong>{course.instructor.name}</strong></span>
            <div className="flex items-center gap-1">
              <StarRating rating={course.rating} />
              <span className="ml-1 font-medium">{course.rating}</span>
              <span className="text-white/70">({course.reviewCount} reviews)</span>
            </div>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {course.enrolledCount.toLocaleString()} enrolled
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {formatDuration(course.duration)}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Column */}
          <div className="flex-1 space-y-8">
            {/* Description */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">About This Course</h2>
              <p className="mt-3 leading-relaxed text-gray-600">{course.fullDescription}</p>
            </section>

            {/* Learning Outcomes */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">What You&apos;ll Learn</h2>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {course.learningOutcomes.map((outcome, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    <span className="text-sm text-gray-600">{outcome}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Course Content */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Course Content</h2>
                <span className="text-sm text-gray-500">
                  {course.modules.length} modules &middot; {totalLessons} lessons &middot;{" "}
                  {formatDuration(course.duration)}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {course.modules.map((mod) => {
                  const isExpanded = expandedModules.includes(mod.id);
                  const modCompleted = mod.lessons.filter((l) => l.completed).length;
                  return (
                    <div key={mod.id} className="overflow-hidden rounded-lg border border-gray-200">
                      <button
                        onClick={() => toggleModule(mod.id)}
                        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-900">{mod.title}</span>
                          <span className="text-xs text-gray-500">
                            {modCompleted}/{mod.lessons.length} completed
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      {isExpanded && (
                        <ul className="divide-y divide-gray-100 bg-white">
                          {mod.lessons.map((lesson) => {
                            const Icon = lessonIcons[lesson.type];
                            return (
                              <li
                                key={lesson.id}
                                className="flex items-center justify-between px-4 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  {lesson.completed ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Icon className="h-5 w-5 text-gray-400" />
                                  )}
                                  <span
                                    className={cn(
                                      "text-sm",
                                      lesson.completed ? "text-gray-500" : "text-gray-700"
                                    )}
                                  >
                                    {lesson.title}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-400">
                                  {formatDuration(lesson.duration)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Instructor */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">Your Instructor</h2>
              <div className="mt-4 flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
                  {course.instructor.avatar}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{course.instructor.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">
                    {course.instructor.bio}
                  </p>
                </div>
              </div>
            </section>

            {/* Reviews */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Student Reviews</h2>
                <div className="flex items-center gap-2">
                  <StarRating rating={course.rating} size="md" />
                  <span className="font-semibold text-gray-900">{course.rating}</span>
                  <span className="text-sm text-gray-500">({course.reviewCount})</span>
                </div>
              </div>
              <div className="mt-5 space-y-5">
                {course.reviews.map((review) => (
                  <div key={review.id} className="border-t border-gray-100 pt-5 first:border-0 first:pt-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                        {review.avatar}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{review.author}</h4>
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} />
                          <span className="text-xs text-gray-400">{formatDate(review.date)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{review.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column - Sticky Enrollment Card */}
          <div className="w-full lg:w-80">
            <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              {enrolled ? (
                <a
                  href={`/learn/player/${course.slug}`}
                  className="block w-full rounded-lg bg-green-600 py-3 text-center text-sm font-semibold text-white hover:bg-green-700"
                >
                  Continue Learning
                </a>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enrolling ? "Enrolling..." : "Enroll Now"}
                </button>
              )}

              {enrolled && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span>{Math.round((completedLessons / totalLessons) * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${(completedLessons / totalLessons) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-900">{course.type}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium text-gray-900">{formatDuration(course.duration)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Difficulty</span>
                  <DifficultyBadge difficulty={course.difficulty} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Certificate</span>
                  <span className="flex items-center gap-1 font-medium text-green-600">
                    <Award className="h-4 w-4" /> Included
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Language</span>
                  <span className="flex items-center gap-1 font-medium text-gray-900">
                    <Globe className="h-4 w-4" /> {course.language}
                  </span>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900">Skills You&apos;ll Gain</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {course.skills.map((skill) => (
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

        {/* Related Courses */}
        <section className="mt-12">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Related Courses</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {course.relatedCourses.map((rc) => (
              <a
                key={rc.slug}
                href={`/learn/catalog/${rc.slug}`}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={cn(
                    "flex h-32 items-center justify-center bg-gradient-to-br",
                    rc.gradient
                  )}
                >
                  <BookOpen className="h-10 w-10 text-white/60" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600">
                    {rc.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">By {rc.instructor}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    <StarRating rating={rc.rating} />
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {formatDuration(rc.duration)}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
