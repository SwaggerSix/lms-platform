"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  FileText,
  Code,
  HelpCircle,
  CheckCircle2,
  Circle,
  Lock,
  Calendar,
  Clock,
} from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/utils/cn";
import { formatDuration } from "@/utils/format";
import { trackEvent } from "@/lib/analytics/track";

const VideoPlayer = dynamic(
  () => import("@/components/course/video-player").then((mod) => mod.VideoPlayer),
  {
    loading: () => <div className="animate-pulse bg-muted aspect-video w-full rounded-lg bg-gray-800" />,
    ssr: false,
  }
);

const SCORMPlayer = dynamic(
  () => import("@/components/course/scorm-player").then((mod) => mod.SCORMPlayer),
  {
    loading: () => <div className="animate-pulse bg-muted h-[500px] w-full rounded-lg bg-gray-800" />,
    ssr: false,
  }
);

export interface PlayerLesson {
  id: string;
  title: string;
  type: "video" | "document" | "html" | "quiz";
  duration: number;
  status: "completed" | "current" | "locked";
  content?: string;
  /** Raw content type from the database (e.g. "video", "scorm", "document") */
  contentTypeRaw?: string;
  /** URL to the lesson content (video URL, SCORM package, document, etc.) */
  contentUrl?: string | null;
  /** Additional content data (poster image, etc.) */
  contentData?: Record<string, unknown> | null;
}

export interface PlayerModule {
  id: string;
  title: string;
  lessons: PlayerLesson[];
  /** Whether this module is available based on drip settings */
  isAvailable?: boolean;
  /** ISO date when this module becomes available */
  availableDate?: string | null;
  /** The drip type for this module */
  dripType?: string;
  /** Human-readable message about when the module unlocks */
  dripMessage?: string | null;
}

export interface PlayerCourse {
  id: string;
  title: string;
  modules: PlayerModule[];
}

export interface PlayerProps {
  course: PlayerCourse;
  initialLessonId: string;
  enrollmentId: string | null;
}

function sanitizeHTML(html: string): string {
  // Use DOMPurify for robust XSS protection
  const DOMPurify = require("dompurify");
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1","h2","h3","h4","h5","h6","p","br","hr","ul","ol","li","a","strong","em","b","i","u","s","blockquote","pre","code","img","table","thead","tbody","tr","th","td","div","span","figure","figcaption","video","source","audio"],
    ALLOWED_ATTR: ["href","src","alt","title","class","id","target","rel","width","height","controls","type"],
    ALLOW_DATA_ATTR: false,
  });
}

const lessonIcons = {
  video: PlayCircle,
  document: FileText,
  html: Code,
  quiz: HelpCircle,
};

export default function PlayerClient({ course, initialLessonId, enrollmentId }: PlayerProps) {
  const [currentLessonId, setCurrentLessonId] = useState(initialLessonId);
  const [expandedModules, setExpandedModules] = useState<string[]>(
    course.modules.map((m) => m.id).slice(0, 2)
  );
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [lessonStatuses, setLessonStatuses] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.status === "completed") map[lesson.id] = "completed";
      }
    }
    return map;
  });

  const lessonStartTime = useRef<number>(Date.now());
  const accumulatedTime = useRef<number>(0);

  // --- Progress tracking helpers ---

  const updateLessonProgress = useCallback(
    async (lessonId: string, status: "in_progress" | "completed") => {
      if (!enrollmentId) return;
      try {
        const res = await fetch("/api/enrollments/progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enrollment_id: enrollmentId,
            lesson_id: lessonId,
            status,
          }),
        });
        if (!res.ok) {
          console.error("Progress update failed:", res.status, res.statusText);
        }
        if (status === "completed") {
          setLessonStatuses((prev) => ({ ...prev, [lessonId]: "completed" }));
          trackEvent("lesson_completed", { lesson_id: lessonId });
        }
      } catch (e) {
        console.error("Failed to update lesson progress:", e);
      }
    },
    [enrollmentId]
  );

  const updateTimeSpent = useCallback(
    async (additionalSeconds: number) => {
      if (!enrollmentId || additionalSeconds < 1) return;
      try {
        await fetch("/api/enrollments/progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enrollment_id: enrollmentId,
            add_time_spent: Math.round(additionalSeconds),
          }),
        });
      } catch (e) {
        console.error("Failed to update time spent:", e);
      }
    },
    [enrollmentId]
  );

  const flushTime = useCallback(() => {
    const elapsed = Math.floor((Date.now() - lessonStartTime.current) / 1000);
    accumulatedTime.current += elapsed;
    lessonStartTime.current = Date.now();
    return accumulatedTime.current;
  }, []);

  // Track course_started on mount
  useEffect(() => {
    trackEvent("course_started", { course_id: course.id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark current lesson as in_progress on mount and when lesson changes
  useEffect(() => {
    lessonStartTime.current = Date.now();
    accumulatedTime.current = 0;
    updateLessonProgress(currentLessonId, "in_progress");
  }, [currentLessonId, updateLessonProgress]);

  // Periodic time tracking (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = flushTime();
      if (seconds >= 30) {
        updateTimeSpent(seconds);
        accumulatedTime.current = 0;
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [flushTime, updateTimeSpent]);

  // Flush time on page unload
  useEffect(() => {
    const handleUnload = () => {
      const seconds = flushTime();
      if (seconds > 0 && enrollmentId) {
        navigator.sendBeacon(
          "/api/enrollments/progress",
          new Blob(
            [
              JSON.stringify({
                enrollment_id: enrollmentId,
                add_time_spent: seconds,
              }),
            ],
            { type: "application/json" }
          )
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [enrollmentId, flushTime]);

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const currentLesson = allLessons.find((l) => l.id === currentLessonId) ?? null;
  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);
  const completedCount = allLessons.filter(
    (l) => l.status === "completed" || lessonStatuses[l.id] === "completed"
  ).length;
  const progressPercent = allLessons.length === 0 ? 0 : Math.round((completedCount / allLessons.length) * 100);

  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const toggleModule = (id: string) => {
    setExpandedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  // Helper: check if a lesson belongs to a drip-locked module
  const isLessonDripLocked = (lessonId: string): boolean => {
    for (const mod of course.modules) {
      if (mod.isAvailable === false) {
        if (mod.lessons.some((l) => l.id === lessonId)) {
          return true;
        }
      }
    }
    return false;
  };

  // Helper: get the drip message for a lesson's module
  const getLessonDripMessage = (lessonId: string): string | null => {
    for (const mod of course.modules) {
      if (mod.lessons.some((l) => l.id === lessonId)) {
        return mod.dripMessage ?? null;
      }
    }
    return null;
  };

  const navigateToLesson = (lessonId: string) => {
    // Prevent navigation to drip-locked modules
    if (isLessonDripLocked(lessonId)) {
      return;
    }

    // Mark current lesson as completed when navigating forward via "Next"
    if (lessonId !== currentLessonId) {
      const targetIndex = allLessons.findIndex((l) => l.id === lessonId);
      if (targetIndex > currentIndex) {
        updateLessonProgress(currentLessonId, "completed");
      }
      // Flush accumulated time
      const seconds = flushTime();
      if (seconds > 0) {
        updateTimeSpent(seconds);
        accumulatedTime.current = 0;
      }
    }
    setCurrentLessonId(lessonId);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Top Bar */}
      <div className="flex h-14 items-center justify-between border-b border-gray-700 bg-gray-800 px-4">
        <div className="flex items-center gap-3">
          <a
            href="/learn/my-courses"
            className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </a>
          <div className="h-5 w-px bg-gray-600" />
          <h1 className="text-sm font-medium text-white">{course.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-700">
              <div
                className={cn("h-full rounded-full", progressPercent === 100 ? "bg-green-500" : "bg-indigo-600")}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{progressPercent}% complete</span>
          </div>
          <button
            onClick={() => setOutlineOpen(!outlineOpen)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white lg:hidden"
          >
            <FileText className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Content Area */}
        <div className={cn("flex flex-1 flex-col", outlineOpen ? "" : "")}>
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!currentLesson && (
              <div className="flex min-h-[400px] items-center justify-center bg-gray-50 p-8">
                <div className="text-center">
                  <HelpCircle className="mx-auto h-16 w-16 text-gray-400" />
                  <h2 className="mt-4 text-xl font-semibold text-gray-900">Lesson not found</h2>
                  <p className="mt-2 text-gray-500">The requested lesson could not be found in this course.</p>
                  <a
                    href="/learn/my-courses"
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                  >
                    Back to My Courses
                  </a>
                </div>
              </div>
            )}

            {currentLesson?.type === "video" && currentLesson.contentUrl && (
              <VideoPlayer
                src={currentLesson.contentUrl}
                title={currentLesson.title}
                poster={
                  (currentLesson.contentData?.poster as string) ??
                  (currentLesson.contentData?.thumbnail as string) ??
                  undefined
                }
                onComplete={() => {
                  updateLessonProgress(currentLessonId, "completed");
                }}
                onTimeUpdate={(currentTime, videoDuration) => {
                  // Could be used for bookmarking in the future
                  void currentTime;
                  void videoDuration;
                }}
              />
            )}

            {currentLesson?.type === "video" && !currentLesson.contentUrl && (
              <div className="flex aspect-video w-full items-center justify-center bg-black">
                <div className="text-center max-w-md px-6">
                  <PlayCircle className="mx-auto h-16 w-16 text-gray-500" />
                  <p className="mt-4 text-base font-medium text-gray-300">No video available</p>
                  <p className="mt-2 text-sm text-gray-500">
                    This lesson has no video content. You can review the materials below or continue to the next lesson.
                  </p>
                  {nextLesson && (
                    <button
                      onClick={() => navigateToLesson(nextLesson.id)}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                    >
                      Next Lesson
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {currentLesson?.contentTypeRaw === "scorm" && currentLesson.contentUrl && (
              <SCORMPlayer
                packageUrl={currentLesson.contentUrl}
                title={currentLesson.title}
                learnerName=""
                learnerId=""
                onComplete={() => {
                  updateLessonProgress(currentLessonId, "completed");
                }}
                className="min-h-[500px]"
              />
            )}

            {currentLesson?.type === "document" && (
              <div className="flex min-h-[400px] flex-col items-center justify-center bg-gray-100 p-8">
                {currentLesson.contentUrl ? (
                  <div className="w-full max-w-4xl">
                    {currentLesson.contentUrl.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/i) ? (
                      <>
                        <iframe
                          src={currentLesson.contentUrl}
                          title={currentLesson.title}
                          className="h-[600px] w-full rounded-lg border border-gray-200 bg-white"
                        />
                        <div className="mt-3 text-center">
                          <a
                            href={currentLesson.contentUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <FileText className="h-4 w-4" />
                            Download Document
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="text-center">
                        <FileText className="mx-auto h-16 w-16 text-gray-300" />
                        <h2 className="mt-4 text-xl font-semibold text-gray-900">
                          {currentLesson.title}
                        </h2>
                        <a
                          href={currentLesson.contentUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          <FileText className="h-4 w-4" />
                          Open Document
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow-sm">
                    <FileText className="mx-auto h-16 w-16 text-gray-300" />
                    <h2 className="mt-4 text-center text-xl font-semibold text-gray-900">
                      {currentLesson.title}
                    </h2>
                    {currentLesson.content && (
                      <div
                        className="prose prose-indigo mt-4 max-w-none"
                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(currentLesson.content) }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {currentLesson?.type === "html" && currentLesson.contentTypeRaw !== "scorm" && (
              <div className="flex min-h-[400px] flex-col items-center justify-center bg-gray-50 p-8">
                <div className="mx-auto w-full max-w-3xl rounded-lg border border-gray-200 bg-white p-8">
                  {currentLesson.content ? (
                    <div
                      className="prose prose-indigo max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHTML(currentLesson.content) }}
                    />
                  ) : currentLesson.contentUrl ? (
                    <iframe
                      src={currentLesson.contentUrl}
                      title={currentLesson.title}
                      className="h-[500px] w-full rounded-lg border-none"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  ) : (
                    <>
                      <Code className="mx-auto h-16 w-16 text-indigo-400" />
                      <h2 className="mt-4 text-center text-xl font-semibold text-gray-900">
                        {currentLesson.title}
                      </h2>
                      <p className="mt-4 text-center text-gray-500">
                        No content available for this lesson
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {currentLesson?.type === "quiz" && (
              <div className="flex min-h-[400px] items-center justify-center bg-gray-50 p-8">
                <div className="text-center">
                  <HelpCircle className="mx-auto h-16 w-16 text-indigo-400" />
                  <h2 className="mt-4 text-xl font-semibold text-gray-900">
                    {currentLesson.title}
                  </h2>
                  <p className="mt-2 text-gray-600">
                    Test your understanding of the concepts covered in this module.
                  </p>
                  {currentLesson.contentUrl ? (
                    <a
                      href={`/learn/assessments/${currentLesson.contentUrl}`}
                      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Start Quiz
                    </a>
                  ) : (
                    <p className="mt-4 text-sm text-gray-400">
                      No quiz is currently linked to this lesson.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Lesson info below content */}
            {currentLesson && (
            <div className="border-t border-gray-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-gray-900">{currentLesson.title}</h2>
              {currentLesson.content && (
                <p className="mt-2 leading-relaxed text-gray-600">{currentLesson.content}</p>
              )}
            </div>
            )}
          </div>

          {/* Navigation Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
            <button
              onClick={() => prevLesson && navigateToLesson(prevLesson.id)}
              disabled={!prevLesson || isLessonDripLocked(prevLesson?.id ?? "")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-sm text-gray-500">
              Lesson {currentIndex + 1} of {allLessons.length}
            </span>
            {nextLesson && isLessonDripLocked(nextLesson.id) ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
                <Lock className="h-4 w-4" />
                {getLessonDripMessage(nextLesson.id) || "Locked"}
              </div>
            ) : (
              <button
                onClick={() => nextLesson && navigateToLesson(nextLesson.id)}
                disabled={!nextLesson}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Panel - Course Outline */}
        <aside
          className={cn(
            "w-80 shrink-0 overflow-y-auto border-l border-gray-700 bg-gray-800",
            outlineOpen ? "block" : "hidden"
          )}
        >
          {/* Progress */}
          <div className="border-b border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white">Course Progress</h3>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
                <div
                  className={cn("h-full rounded-full", progressPercent === 100 ? "bg-green-500" : "bg-indigo-600")}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{progressPercent}%</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {completedCount} of {allLessons.length} lessons completed
            </p>
          </div>

          {/* Drip Timeline */}
          {course.modules.some((m) => m.dripType && m.dripType !== "immediate") && (
            <div className="border-b border-gray-700 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Release Schedule</h3>
              <div className="space-y-2">
                {course.modules.map((mod, i) => {
                  const isLocked = mod.isAvailable === false;
                  return (
                    <div key={mod.id} className="flex items-center gap-2.5">
                      <div className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                        isLocked ? "bg-gray-600 text-gray-400" : "bg-indigo-600 text-white"
                      )}>
                        {isLocked ? <Lock className="h-3 w-3" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs truncate", isLocked ? "text-gray-500" : "text-gray-300")}>
                          {mod.title}
                        </p>
                        {isLocked && mod.dripMessage && (
                          <p className="text-[10px] text-amber-500 flex items-center gap-1">
                            {mod.dripType === "on_date" || mod.dripType === "after_days" ? (
                              <Calendar className="h-2.5 w-2.5" />
                            ) : (
                              <Clock className="h-2.5 w-2.5" />
                            )}
                            {mod.dripMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Module list */}
          <div className="divide-y divide-gray-700">
            {course.modules.map((mod) => {
              const isExpanded = expandedModules.includes(mod.id);
              const isModuleLocked = mod.isAvailable === false;
              const modCompleted = mod.lessons.filter(
                (l) => l.status === "completed" || lessonStatuses[l.id] === "completed"
              ).length;
              return (
                <div key={mod.id}>
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-3 text-left",
                      isModuleLocked ? "opacity-60" : "hover:bg-gray-750"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isModuleLocked && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", isModuleLocked ? "text-gray-400" : "text-gray-200")}>{mod.title}</p>
                        {isModuleLocked && mod.dripMessage ? (
                          <p className="mt-0.5 text-xs text-amber-500">{mod.dripMessage}</p>
                        ) : (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {modCompleted}/{mod.lessons.length} lessons
                          </p>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  {isExpanded && (
                    <ul className="pb-2">
                      {mod.lessons.map((lesson) => {
                        const Icon = lessonIcons[lesson.type];
                        const isCurrent = lesson.id === currentLessonId;
                        const isLessonLocked = isModuleLocked && lesson.status !== "completed";
                        return (
                          <li key={lesson.id}>
                            <button
                              onClick={() => !isLessonLocked && navigateToLesson(lesson.id)}
                              disabled={isLessonLocked}
                              className={cn(
                                "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                isLessonLocked
                                  ? "text-gray-600 cursor-not-allowed"
                                  : isCurrent
                                    ? "bg-indigo-600/20 text-white"
                                    : "text-gray-400 hover:bg-gray-700/50 hover:text-gray-200"
                              )}
                            >
                              {isLessonLocked ? (
                                <Lock className="h-5 w-5 shrink-0 text-gray-600" />
                              ) : lesson.status === "completed" || lessonStatuses[lesson.id] === "completed" ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                              ) : isCurrent ? (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-indigo-500 bg-indigo-500">
                                  <div className="h-2 w-2 rounded-full bg-white" />
                                </div>
                              ) : (
                                <Circle className="h-5 w-5 shrink-0 text-gray-600" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={cn("truncate text-sm", isLessonLocked && "text-gray-600")}>{lesson.title}</p>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <Icon className="h-3 w-3" />
                                  {formatDuration(lesson.duration)}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
