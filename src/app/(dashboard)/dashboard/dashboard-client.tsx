"use client";

import { cn } from "@/utils/cn";
import {
  BookOpen,
  CheckCircle2,
  Award,
  Flame,
  Clock,
  ArrowRight,
  Play,
  Star,
  Trophy,
  Target,
  Zap,
  Sparkles,
  Users,
  TrendingUp,
} from "lucide-react";

export interface LearnerDashboardData {
  userName: string;
  coursesInProgress: number;
  coursesCompleted: number;
  certificatesEarned: number;
  inProgressCourses: {
    id: string;
    title: string;
    instructor: string;
    thumbnail: string;
    progress: number;
    totalLessons: number;
    completedLessons: number;
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
    description: string;
    thumbnail: string;
    instructor: string;
    enrolled: number;
    rating: number;
    duration: string;
    type: string;
    badge: string;
  }[];
}

const recentAchievements = [
  {
    id: "1",
    title: "Fast Learner",
    description: "Complete 3 courses in one month",
    icon: Zap,
    color: "text-yellow-500",
    bg: "bg-yellow-50",
    date: "2 days ago",
  },
  {
    id: "2",
    title: "Perfect Score",
    description: "Score 100% on an assessment",
    icon: Target,
    color: "text-green-500",
    bg: "bg-green-50",
    date: "5 days ago",
  },
  {
    id: "3",
    title: "Team Player",
    description: "Help 5 peers in discussions",
    icon: Trophy,
    color: "text-purple-500",
    bg: "bg-purple-50",
    date: "1 week ago",
  },
];

export default function LearnerDashboardClient({ data }: { data: LearnerDashboardData }) {
  const stats = [
    {
      label: "Courses in Progress",
      value: String(data.coursesInProgress),
      change: "+1 this week",
      icon: BookOpen,
      color: "bg-blue-500",
      bgLight: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      label: "Completed Courses",
      value: String(data.coursesCompleted),
      change: "+2 this month",
      icon: CheckCircle2,
      color: "bg-green-500",
      bgLight: "bg-green-50",
      textColor: "text-green-600",
    },
    {
      label: "Certificates Earned",
      value: String(data.certificatesEarned),
      change: "1 pending",
      icon: Award,
      color: "bg-purple-500",
      bgLight: "bg-purple-50",
      textColor: "text-purple-600",
    },
    {
      label: "Learning Streak",
      value: "7 days",
      change: "Personal best!",
      icon: Flame,
      color: "bg-orange-500",
      bgLight: "bg-orange-50",
      textColor: "text-orange-600",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-8 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Welcome back, {data.userName}!</h1>
          <p className="mt-1 text-indigo-100">
            You&apos;re on a 7-day learning streak. Keep it going!
          </p>
          <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600">
            <Play className="h-4 w-4" aria-hidden="true" />
            Continue Learning
          </button>
        </div>
        <div className="absolute -right-4 -top-4 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 right-20 h-32 w-32 rounded-full bg-white/5" />
      </div>

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
              <p className={cn("mt-1 text-xs font-medium", stat.textColor)}>{stat.change}</p>
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
            <a href="/learn/catalog" className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all courses
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.spotlightCourses.map((course) => (
              <div
                key={course.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={cn("relative flex h-40 items-end p-4", course.thumbnail)}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span
                    className={cn(
                      "absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                      course.badge === "Most Popular"
                        ? "bg-amber-400 text-amber-900"
                        : course.badge === "New"
                          ? "bg-emerald-400 text-emerald-900"
                          : "bg-red-400 text-white"
                    )}
                  >
                    {course.badge}
                  </span>
                  <div className="relative z-10">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                      {course.type}
                    </span>
                    <h3 className="mt-1.5 text-lg font-bold text-white">{course.title}</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 text-sm text-gray-600">{course.description}</p>
                  <p className="mt-2 text-sm text-gray-500">{course.instructor}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {course.rating}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {course.enrolled}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.duration}
                      </span>
                    </div>
                    <button className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Enroll
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Continue Learning */}
      {data.inProgressCourses.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Continue Learning</h2>
            <a href="/learn/my-courses" className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.inProgressCourses.map((course) => (
              <div
                key={course.id}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className={cn("flex h-36 items-center justify-center", course.thumbnail)}>
                  <Play className="h-12 w-12 text-white/80 transition-transform group-hover:scale-110" />
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                      {course.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{course.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">{course.instructor}</p>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        {course.completedLessons}/{course.totalLessons} lessons
                      </span>
                      <span className="font-medium text-indigo-600">{course.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
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
            <a href="/learn/achievements" className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              All
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="space-y-3">
            {recentAchievements.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", achievement.bg)}>
                    <Icon className={cn("h-5 w-5", achievement.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{achievement.title}</p>
                    <p className="truncate text-xs text-gray-500">{achievement.description}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-gray-500">{achievement.date}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
