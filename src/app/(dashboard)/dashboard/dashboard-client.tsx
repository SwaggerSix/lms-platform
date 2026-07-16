"use client";

import { cn } from "@/utils/cn";
import {
  BookOpen,
  CheckCircle2,
  Award,
  Clock,
  ArrowRight,
  Play,
  Star,
  Trophy,
  Sparkles,
  Users,
  TrendingUp,
} from "lucide-react";

export interface LearnerDashboardData {
  userName: string;
  coursesInProgress: number;
  coursesCompleted: number;
  certificatesEarned: number;
  upcomingDeadlinesCount: number;
  inProgressCourses: {
    id: string;
    courseId: string;
    title: string;
    instructor: string | null;
    thumbnail: string;
    progress: number;
    category: string;
  }[];
  upcomingDeadlines: {
    id: string;
    course: string;
    type: string;
    dueDate: string;
    daysLeft: number;
    status: string;
  }[];
  spotlightCourses: {
    id: string;
    title: string;
    slug: string;
    description: string;
    thumbnail: string;
    instructor: string | null;
    enrolled: number;
    rating: number;
    duration: string;
    type: string;
    badge: string | null;
  }[];
  recentAchievements: {
    id: string;
    title: string;
    description: string;
    awardedAt: string;
  }[];
}

function formatAwardedDate(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function LearnerDashboardClient({ data }: { data: LearnerDashboardData }) {
  // Brand-new learner: nothing started, completed, or earned yet. Drives the
  // first-run getting-started card and the "browse" (vs "continue") CTA.
  const isNewUser =
    data.coursesInProgress === 0 &&
    data.coursesCompleted === 0 &&
    data.certificatesEarned === 0;

  const stats = [
    {
      label: "Courses in Progress",
      value: String(data.coursesInProgress),
      icon: BookOpen,
      bgLight: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      label: "Completed Courses",
      value: String(data.coursesCompleted),
      icon: CheckCircle2,
      bgLight: "bg-green-50",
      textColor: "text-green-600",
    },
    {
      label: "Certificates Earned",
      value: String(data.certificatesEarned),
      icon: Award,
      bgLight: "bg-purple-50",
      textColor: "text-purple-600",
    },
    {
      label: "Upcoming Deadlines",
      value: String(data.upcomingDeadlinesCount),
      icon: Clock,
      bgLight: "bg-orange-50",
      textColor: "text-orange-600",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-8 py-8 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">
            {isNewUser ? `Welcome, ${data.userName}!` : `Welcome back, ${data.userName}!`}
          </h1>
          <p className="mt-1 text-primary-100">
            {isNewUser
              ? "This is your training site — take your assigned courses and track what you've finished. Start by browsing the catalog."
              : data.coursesInProgress > 0
                ? `You have ${data.coursesInProgress} course${data.coursesInProgress === 1 ? "" : "s"} in progress. Pick up where you left off!`
                : "Explore the catalog to start your next course."}
          </p>
          <a
            href={data.inProgressCourses[0] ? `/learn/player/${data.inProgressCourses[0].courseId}` : "/learn/catalog"}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600"
          >
            {data.coursesInProgress > 0 ? (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                Continue Learning
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Browse the catalog
              </>
            )}
          </a>
        </div>
        <div className="absolute -right-4 -top-4 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 right-20 h-32 w-32 rounded-full bg-white/5" />
      </div>

      {/* First-run getting-started card */}
      {isNewUser && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden rounded-lg bg-primary-100 p-2.5 sm:block">
              <Sparkles className="h-5 w-5 text-primary-700" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">
                New here? Let&apos;s get you started
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Browse the catalog to enroll in your first course, or read your
                role guide to learn your way around the platform.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="/learn/catalog"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Browse the catalog
                </a>
                <a
                  href="/help"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Read your guide
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.bgLight)}>
                  <Icon className={cn("h-5 w-5", stat.textColor)} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Course Spotlight */}
      {data.spotlightCourses.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">Course Spotlight</h2>
            </div>
            <div className="flex items-center gap-4">
              <a href="/learn/recommendations" className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                Recommended for you
              </a>
              <a href="/learn/catalog" className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                View all courses
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.spotlightCourses.map((course) => (
              <a
                key={course.id}
                href={`/learn/catalog/${course.slug}`}
                className="group relative block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div className={cn("relative flex h-40 items-end p-4", course.thumbnail)}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {course.badge && (
                    <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-900">
                      {course.badge}
                    </span>
                  )}
                  <div className="relative z-10">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                      {course.type}
                    </span>
                    <h3 className="mt-1.5 text-lg font-bold text-white">{course.title}</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 text-sm text-gray-600">{course.description}</p>
                  {course.instructor && (
                    <p className="mt-2 text-sm text-gray-500">{course.instructor}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {course.rating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {course.rating}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {course.enrolled}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.duration}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 transition-colors group-hover:bg-primary-100">
                      <TrendingUp className="h-3.5 w-3.5" />
                      View
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Continue Learning */}
      {data.inProgressCourses.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Continue Learning</h2>
            <a href="/learn/my-courses" className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
              View all
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.inProgressCourses.map((course) => (
              <a
                key={course.id}
                href={`/learn/player/${course.courseId}`}
                className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div className={cn("flex h-36 items-center justify-center", course.thumbnail)}>
                  <Play className="h-12 w-12 text-white/80 transition-transform group-hover:scale-110" />
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-600">
                      {course.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{course.title}</h3>
                  {course.instructor && (
                    <p className="mt-0.5 text-sm text-gray-500">{course.instructor}</p>
                  )}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium text-primary-600">{course.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary-600 transition-all"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Two-column layout: Deadlines + Achievements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming Deadlines */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Course</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.upcomingDeadlines.length > 0 ? data.upcomingDeadlines.map((deadline) => (
                  <tr key={deadline.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{deadline.course}</p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          deadline.type === "Mandatory"
                            ? "bg-red-50 text-red-700"
                            : deadline.type === "Compliance"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {deadline.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Clock className="h-3.5 w-3.5" />
                        {deadline.dueDate}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          deadline.status === "urgent"
                            ? "bg-red-50 text-red-700"
                            : deadline.status === "upcoming"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700"
                        )}
                      >
                        {deadline.daysLeft}d left
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      No upcoming deadlines
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Achievements */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Achievements</h2>
            <a href="/learn/achievements" className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
              All
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          {data.recentAchievements.length > 0 ? (
            <div className="space-y-3">
              {data.recentAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{achievement.title}</p>
                    <p className="truncate text-xs text-gray-500">{achievement.description}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-gray-500">
                    {formatAwardedDate(achievement.awardedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <Trophy className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-gray-900">No badges yet</p>
              <p className="mt-1 text-xs text-gray-500">
                Complete courses and assessments to earn your first badge.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
