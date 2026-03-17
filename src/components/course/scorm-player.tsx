"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/utils/cn";
import {
  Maximize,
  Minimize,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";

/**
 * SCORM API data model.
 * Supports SCORM 1.2 and 2004 data elements.
 */
export interface SCORMData {
  /** Learner name */
  learnerName: string;
  /** Learner ID */
  learnerId: string;
  /** Lesson status: passed, completed, failed, incomplete, browsed, not attempted */
  lessonStatus: string;
  /** Score (0-100) */
  scoreRaw: number | null;
  /** Minimum passing score */
  scoreMin: number | null;
  /** Maximum score */
  scoreMax: number | null;
  /** Bookmark / last location */
  lessonLocation: string;
  /** Session time */
  sessionTime: string;
  /** Total time */
  totalTime: string;
  /** Suspend data (JSON string for complex state) */
  suspendData: string;
  /** Completion status */
  completionStatus: string;
  /** Success status */
  successStatus: string;
}

export interface SCORMPlayerProps {
  /** URL to SCORM package index.html */
  packageUrl: string;
  /** Course title */
  title: string;
  /** Learner info */
  learnerName: string;
  learnerId: string;
  /** Initial SCORM data (for resume) */
  initialData?: Partial<SCORMData>;
  /** Callback when SCORM data changes */
  onDataChange?: (data: Partial<SCORMData>) => void;
  /** Callback when course is completed */
  onComplete?: (data: SCORMData) => void;
  /** Callback when SCORM calls Commit */
  onCommit?: (data: Partial<SCORMData>) => void;
  /** Custom className */
  className?: string;
}

const defaultSCORMData: SCORMData = {
  learnerName: "",
  learnerId: "",
  lessonStatus: "not attempted",
  scoreRaw: null,
  scoreMin: 0,
  scoreMax: 100,
  lessonLocation: "",
  sessionTime: "0000:00:00.00",
  totalTime: "0000:00:00.00",
  suspendData: "",
  completionStatus: "not attempted",
  successStatus: "unknown",
};

export function SCORMPlayer({
  packageUrl,
  title,
  learnerName,
  learnerId,
  initialData,
  onDataChange,
  onComplete,
  onCommit,
  className,
}: SCORMPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scormData, setScormData] = useState<SCORMData>({
    ...defaultSCORMData,
    learnerName,
    learnerId,
    ...initialData,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // SCORM 1.2 API implementation
  const createSCORMAPI = useCallback(() => {
    const data = { ...scormData };

    const api = {
      // SCORM 1.2 methods
      LMSInitialize: () => {
        setIsInitialized(true);
        setIsLoading(false);
        return "true";
      },
      LMSFinish: () => {
        setIsInitialized(false);
        if (data.lessonStatus === "completed" || data.lessonStatus === "passed") {
          onComplete?.(data);
        }
        return "true";
      },
      LMSGetValue: (element: string) => {
        const mapping: Record<string, string | number | null> = {
          "cmi.core.student_name": data.learnerName,
          "cmi.core.student_id": data.learnerId,
          "cmi.core.lesson_status": data.lessonStatus,
          "cmi.core.lesson_location": data.lessonLocation,
          "cmi.core.score.raw": data.scoreRaw,
          "cmi.core.score.min": data.scoreMin,
          "cmi.core.score.max": data.scoreMax,
          "cmi.core.total_time": data.totalTime,
          "cmi.suspend_data": data.suspendData,
          // SCORM 2004 equivalents
          "cmi.learner_name": data.learnerName,
          "cmi.learner_id": data.learnerId,
          "cmi.completion_status": data.completionStatus,
          "cmi.success_status": data.successStatus,
          "cmi.score.raw": data.scoreRaw,
          "cmi.score.min": data.scoreMin,
          "cmi.score.max": data.scoreMax,
          "cmi.location": data.lessonLocation,
          "cmi.total_time": data.totalTime,
        };
        const value = mapping[element];
        return value !== null && value !== undefined ? String(value) : "";
      },
      LMSSetValue: (element: string, value: string) => {
        const updates: Partial<SCORMData> = {};

        switch (element) {
          case "cmi.core.lesson_status":
            updates.lessonStatus = value;
            break;
          case "cmi.core.lesson_location":
          case "cmi.location":
            updates.lessonLocation = value;
            break;
          case "cmi.core.score.raw":
          case "cmi.score.raw":
            updates.scoreRaw = parseFloat(value);
            break;
          case "cmi.core.session_time":
          case "cmi.session_time":
            updates.sessionTime = value;
            break;
          case "cmi.suspend_data":
            updates.suspendData = value;
            break;
          case "cmi.completion_status":
            updates.completionStatus = value;
            break;
          case "cmi.success_status":
            updates.successStatus = value;
            break;
        }

        if (Object.keys(updates).length > 0) {
          Object.assign(data, updates);
          setScormData({ ...data });
          onDataChange?.(updates);
        }
        return "true";
      },
      LMSCommit: () => {
        onCommit?.({ ...data });
        return "true";
      },
      LMSGetLastError: () => "0",
      LMSGetErrorString: () => "No Error",
      LMSGetDiagnostic: () => "",

      // SCORM 2004 aliases
      Initialize: () => api.LMSInitialize(),
      Terminate: () => api.LMSFinish(),
      GetValue: (element: string) => api.LMSGetValue(element),
      SetValue: (element: string, value: string) => api.LMSSetValue(element, value),
      Commit: () => api.LMSCommit(),
      GetLastError: () => api.LMSGetLastError(),
      GetErrorString: () => api.LMSGetErrorString(),
      GetDiagnostic: () => api.LMSGetDiagnostic(),
    };

    return api;
  }, [scormData, learnerName, learnerId, onComplete, onDataChange, onCommit]);

  // Inject SCORM API into iframe
  useEffect(() => {
    const api = createSCORMAPI();

    // Make API available globally for SCORM content
    // SCORM 1.2 expects window.API, SCORM 2004 expects window.API_1484_11
    (window as unknown as Record<string, unknown>).API = api;
    (window as unknown as Record<string, unknown>).API_1484_11 = api;

    return () => {
      delete (window as unknown as Record<string, unknown>).API;
      delete (window as unknown as Record<string, unknown>).API_1484_11;
    };
  }, [createSCORMAPI]);

  // Track fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const statusColor = (() => {
    switch (scormData.lessonStatus) {
      case "completed":
      case "passed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "incomplete":
        return "text-amber-600";
      default:
        return "text-gray-500";
    }
  })();

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white",
        isFullscreen && "fixed inset-0 z-[9999] rounded-none border-none",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Loading...
            </span>
          )}
          {isInitialized && (
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", statusColor)}>
              {scormData.lessonStatus === "completed" || scormData.lessonStatus === "passed" ? (
                <CheckCircle className="h-3 w-3" aria-hidden="true" />
              ) : null}
              {scormData.lessonStatus.replace("_", " ")}
              {scormData.scoreRaw !== null && ` (${scormData.scoreRaw}%)`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (iframeRef.current) {
                iframeRef.current.src = packageUrl;
                setIsLoading(true);
              }
            }}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            aria-label="Reload SCORM content"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                containerRef.current?.requestFullscreen();
              }
            }}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          {isFullscreen && (
            <button
              onClick={() => document.exitFullscreen()}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              aria-label="Close fullscreen"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* SCORM content iframe */}
      <div className="relative flex-1">
        {error ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
              <p className="mt-3 text-sm font-medium text-gray-900">Failed to load content</p>
              <p className="mt-1 text-sm text-gray-500">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  if (iframeRef.current) iframeRef.current.src = packageUrl;
                }}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={packageUrl}
            title={`SCORM content: ${title}`}
            className="h-full w-full border-none"
            style={{ minHeight: isFullscreen ? "100%" : "500px" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={() => setIsLoading(false)}
            onError={() => setError("Could not load SCORM content. Please try again.")}
          />
        )}
      </div>
    </div>
  );
}
