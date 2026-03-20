"use client";

import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, BookOpen, ArrowRight } from "lucide-react";
import { getOfflineCourses, type OfflineCourseRecord } from "@/lib/offline/cache-manager";

export default function OfflinePage() {
  const [cachedCourses, setCachedCourses] = useState<OfflineCourseRecord[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setCachedCourses(getOfflineCourses());
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <WifiOff className="h-10 w-10 text-gray-400" />
        </div>

        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          You&apos;re currently offline
        </h1>
        <p className="mt-2 text-gray-500">
          It looks like you&apos;ve lost your internet connection. Some features
          may not be available until you&apos;re back online.
        </p>

        {isOnline && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            You&apos;re back online! Click the button below to reload.
          </div>
        )}

        <button
          onClick={() => window.location.href = "/dashboard"}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>

        {cachedCourses.length > 0 && (
          <div className="mt-10 w-full text-left">
            <h2 className="text-lg font-semibold text-gray-900">
              Available Offline
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              These courses were saved for offline access.
            </p>
            <ul className="mt-4 space-y-3">
              {cachedCourses.map((course) => (
                <li key={course.courseId}>
                  <a
                    href={`/learn/catalog/${course.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                      <BookOpen className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {course.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        Saved {new Date(course.cachedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
