"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Trash2, CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  downloadCourseForOffline,
  removeCourseFromOffline,
  isCourseAvailableOffline,
} from "@/lib/offline/cache-manager";

interface OfflineDownloadProps {
  courseId: string;
  slug: string;
  title: string;
  /** Compact mode shows a smaller button (for card layouts) */
  compact?: boolean;
}

export default function OfflineDownload({
  courseId,
  slug,
  title,
  compact = false,
}: OfflineDownloadProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setIsOffline(isCourseAvailableOffline(courseId));
    setChecking(false);
  }, [courseId]);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const success = await downloadCourseForOffline(courseId, slug, title);
      if (success) {
        setIsOffline(true);
      }
    } catch {
      // Failed silently
    } finally {
      setLoading(false);
    }
  }, [courseId, slug, title]);

  const handleRemove = useCallback(async () => {
    setLoading(true);
    try {
      await removeCourseFromOffline(courseId);
      setIsOffline(false);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  if (checking) return null;

  if (compact) {
    if (isOffline) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            <WifiOff className="h-3 w-3" />
            Offline
          </span>
          <button
            onClick={handleRemove}
            disabled={loading}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:opacity-50"
            title="Remove offline download"
            aria-label="Remove offline download"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        title="Download for offline access"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        {loading ? "Saving..." : "Save Offline"}
      </button>
    );
  }

  // Full-size button
  if (isOffline) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          Available Offline
        </span>
        <button
          onClick={handleRemove}
          disabled={loading}
          className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 disabled:opacity-50"
          title="Remove offline download"
          aria-label="Remove offline download"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700",
        "hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {loading ? "Downloading..." : "Download for Offline"}
    </button>
  );
}
