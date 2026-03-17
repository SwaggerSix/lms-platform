"use client";

import { useState } from "react";
import { Clock, BookOpen, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate, formatDuration } from "@/utils/format";

export interface MyCourse {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  progress: number;
  status: "in_progress" | "completed";
  lastAccessed: string;
  dueDate: string | null;
  duration: number;
  gradient: string;
  completedAt: string | null;
}

function getDueDateStatus(dueDate: string | null): "none" | "ok" | "warning" | "danger" {
  if (!dueDate) return "none";
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "danger";
  if (diffDays <= 7) return "danger";
  if (diffDays <= 14) return "warning";
  return "ok";
}

const TABS = [
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function MyCoursesClient({ courses }: { courses: MyCourse[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("in_progress");

  const filteredCourses =
    activeTab === "all"
      ? courses
      : courses.filter((c) => c.status === activeTab);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
        <p className="mt-1 text-gray-500">Track your learning progress and pick up where you left off.</p>

        {/* Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map((tab) => {
              const count =
                tab.key === "all"
                  ? courses.length
                  : courses.filter((c) => c.status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative pb-3 text-sm font-medium transition-colors",
                    activeTab === tab.key
                      ? "text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-2 py-0.5 text-xs",
                      activeTab === tab.key
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {count}
                  </span>
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Course Cards */}
        {filteredCourses.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => {
              const dueDateStatus = getDueDateStatus(course.dueDate);
              return (
                <div
                  key={course.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
                >
                  {/* Thumbnail */}
                  <div
                    className={cn(
                      "flex h-32 items-center justify-center bg-gradient-to-br",
                      course.gradient
                    )}
                  >
                    <BookOpen className="h-10 w-10 text-white/60" />
                  </div>

                  <div className="p-5">
                    <h3 className="font-semibold text-gray-900">{course.title}</h3>
                    <p className="mt-0.5 text-sm text-gray-500">By {course.instructor}</p>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium text-gray-900">{course.progress}%</span>
                      </div>
                      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            course.progress === 100 ? "bg-green-500" : "bg-indigo-600"
                          )}
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Last accessed: {formatDate(course.lastAccessed)}
                      </span>
                      {course.completedAt && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Completed {formatDate(course.completedAt)}
                        </span>
                      )}
                    </div>

                    {/* Due date warning */}
                    {course.dueDate && (dueDateStatus === "warning" || dueDateStatus === "danger") && (
                      <div
                        className={cn(
                          "mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium",
                          dueDateStatus === "danger"
                            ? "bg-red-50 text-red-700"
                            : "bg-yellow-50 text-yellow-700"
                        )}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Due {formatDate(course.dueDate)}
                      </div>
                    )}

                    {/* Action Button */}
                    <a
                      href={
                        course.status === "in_progress"
                          ? `/learn/player/${course.slug}`
                          : `/learn/catalog/${course.slug}`
                      }
                      className={cn(
                        "mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                        course.status === "in_progress"
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      {course.status === "in_progress" ? "Continue" : "Review"}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 flex flex-col items-center justify-center py-16">
            <BookOpen className="h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No courses here yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === "in_progress"
                ? "You haven't started any courses. Browse the catalog to get started!"
                : activeTab === "completed"
                ? "You haven't completed any courses yet. Keep learning!"
                : "No courses found."}
            </p>
            <a
              href="/learn/catalog"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Browse Catalog
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
