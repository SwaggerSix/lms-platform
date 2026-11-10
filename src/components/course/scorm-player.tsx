"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/utils/cn";
import { Maximize, Minimize, RefreshCw, CheckCircle, Loader2, X } from "lucide-react";
import {
  EMPTY_RUNTIME_STATE,
  formatScorm12Time,
  formatScorm2004Time,
  isScormComplete,
  parseScormTime,
  scorePercent,
  toPlayableScormUrl,
  type ScormRuntimeState,
} from "@/lib/scorm/package";

export interface SCORMPlayerProps {
  /** Launch URL of the package (same-origin /scorm-content/... path). */
  packageUrl: string;
  title: string;
  learnerName: string;
  learnerId: string;
  /** Saved runtime state for resume (from /api/scorm/runtime). */
  initialState?: ScormRuntimeState | null;
  /** The LMS already has this lesson marked complete (don't re-report). */
  alreadyCompleted?: boolean;
  /** Fired once, as soon as the package reports completion/pass. */
  onComplete?: (state: ScormRuntimeState) => void;
  /**
   * Save runtime state. `final` is true on unload, when the caller should
   * use navigator.sendBeacon / keepalive so the request survives the page.
   */
  onPersist?: (state: ScormRuntimeState, final: boolean) => void;
  className?: string;
  /** Fill the container's height (the course player) instead of a 600px minimum. */
  fill?: boolean;
}

type Api = Record<string, (...args: string[]) => string>;

const PERSIST_THROTTLE_MS = 5000;

const CORE_CHILDREN_12 =
  "student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time";

/**
 * SCORM 1.2 + 2004 runtime. The API object is created once per mount and kept
 * stable: content caches the reference it finds on window.parent at launch, so
 * replacing it (as a re-render would) leaves the content talking to a stale
 * copy. All mutable state lives in refs; React state is only for the header.
 */
export function SCORMPlayer({
  packageUrl,
  title,
  learnerName,
  learnerId,
  initialState,
  alreadyCompleted = false,
  onComplete,
  onPersist,
  className,
  fill = false,
}: SCORMPlayerProps) {
  const src = toPlayableScormUrl(packageUrl);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [display, setDisplay] = useState<{ status: string; score: number | null; active: boolean }>({
    status: "",
    score: null,
    active: false,
  });

  const stateRef = useRef<ScormRuntimeState>({ ...EMPTY_RUNTIME_STATE, ...(initialState ?? {}) });
  const extraRef = useRef<Record<string, string>>({});
  const exitRef = useRef("");
  const sessionSecondsRef = useRef(0);
  const sessionStartRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const lastErrorRef = useRef("0");
  const completedRef = useRef(alreadyCompleted);
  const dirtyRef = useRef(false);
  const lastPersistRef = useRef(0);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onComplete, onPersist });
  callbacksRef.current = { onComplete, onPersist };
  const learnerRef = useRef({ learnerName, learnerId });
  learnerRef.current = { learnerName, learnerId };

  useEffect(() => {
    const snapshot = (): ScormRuntimeState => {
      const elapsed = sessionStartRef.current ? (Date.now() - sessionStartRef.current) / 1000 : 0;
      // Prefer the package's own session_time; fall back to wall clock.
      const session = sessionSecondsRef.current > 0 ? sessionSecondsRef.current : elapsed;
      return { ...stateRef.current, totalTimeSeconds: stateRef.current.totalTimeSeconds + session };
    };

    const persist = (final: boolean) => {
      if (!dirtyRef.current && !final) return;
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      dirtyRef.current = false;
      lastPersistRef.current = Date.now();
      callbacksRef.current.onPersist?.(snapshot(), final);
    };

    const schedulePersist = () => {
      dirtyRef.current = true;
      if (persistTimerRef.current) return;
      const wait = Math.max(0, PERSIST_THROTTLE_MS - (Date.now() - lastPersistRef.current));
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        persist(false);
      }, wait);
    };

    const refreshDisplay = () => {
      const s = stateRef.current;
      const status =
        s.successStatus === "passed" || s.successStatus === "failed"
          ? s.successStatus
          : s.completionStatus !== "unknown" && s.completionStatus !== "not attempted"
            ? s.completionStatus
            : s.lessonStatus;
      setDisplay({ status, score: scorePercent(s), active: initializedRef.current });
    };

    const checkComplete = () => {
      if (!completedRef.current && isScormComplete(stateRef.current)) {
        completedRef.current = true;
        callbacksRef.current.onComplete?.({ ...snapshot() });
        persist(false);
      }
    };

    const countOf = (prefix: string) => {
      let max = -1;
      const re = new RegExp(`^${prefix.replace(/\./g, "\\.")}\\.(\\d+)\\.`);
      for (const k of Object.keys(extraRef.current)) {
        const m = k.match(re);
        if (m) max = Math.max(max, Number(m[1]));
      }
      return String(max + 1);
    };

    const getValue = (element: string, v2004: boolean): string => {
      if (!initializedRef.current) {
        lastErrorRef.current = v2004 ? "122" : "301";
        return "";
      }
      lastErrorRef.current = "0";
      const s = stateRef.current;
      const { learnerName: name, learnerId: id } = learnerRef.current;
      const hasResume = !!(s.suspendData || s.location);
      const num = (n: number | null) => (n === null ? "" : String(n));
      switch (element) {
        case "cmi.core.student_id":
        case "cmi.learner_id":
          return id;
        case "cmi.core.student_name":
        case "cmi.learner_name":
          return name;
        case "cmi.core.lesson_location":
        case "cmi.location":
          return s.location;
        case "cmi.core.lesson_status":
          return s.lessonStatus;
        case "cmi.completion_status":
          return s.completionStatus;
        case "cmi.success_status":
          return s.successStatus;
        case "cmi.core.entry":
        case "cmi.entry":
          return hasResume ? "resume" : "ab-initio";
        case "cmi.core.credit":
        case "cmi.credit":
          return "credit";
        case "cmi.core.lesson_mode":
        case "cmi.mode":
          return "normal";
        case "cmi.core.score.raw":
        case "cmi.score.raw":
          return num(s.scoreRaw);
        case "cmi.core.score.min":
        case "cmi.score.min":
          return num(s.scoreMin);
        case "cmi.core.score.max":
        case "cmi.score.max":
          return num(s.scoreMax);
        case "cmi.score.scaled":
          return num(s.scoreScaled);
        case "cmi.core.total_time":
          return formatScorm12Time(s.totalTimeSeconds);
        case "cmi.total_time":
          return formatScorm2004Time(s.totalTimeSeconds);
        case "cmi.suspend_data":
          return s.suspendData;
        case "cmi.launch_data":
          return "";
        case "cmi._version":
          return "1.0";
        case "cmi.core._children":
          return CORE_CHILDREN_12;
        case "cmi.core.score._children":
          return "raw,min,max";
        case "cmi.score._children":
          return "scaled,raw,min,max";
        case "cmi.core.exit":
        case "cmi.exit":
        case "cmi.core.session_time":
        case "cmi.session_time":
          // Write-only elements.
          lastErrorRef.current = v2004 ? "405" : "404";
          return "";
      }
      if (element.endsWith("._count")) return countOf(element.slice(0, -"._count".length));
      return extraRef.current[element] ?? "";
    };

    const setValue = (element: string, rawValue: string, v2004: boolean): string => {
      if (!initializedRef.current) {
        lastErrorRef.current = v2004 ? "132" : "301";
        return "false";
      }
      lastErrorRef.current = "0";
      const value = String(rawValue ?? "");
      const s = stateRef.current;
      const asNum = (v: string) => {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : null;
      };
      switch (element) {
        case "cmi.core.lesson_status":
          s.lessonStatus = value;
          break;
        case "cmi.completion_status":
          s.completionStatus = value;
          break;
        case "cmi.success_status":
          s.successStatus = value;
          break;
        case "cmi.core.lesson_location":
        case "cmi.location":
          s.location = value;
          break;
        case "cmi.suspend_data":
          s.suspendData = value;
          break;
        case "cmi.core.score.raw":
        case "cmi.score.raw":
          s.scoreRaw = asNum(value);
          break;
        case "cmi.core.score.min":
        case "cmi.score.min":
          s.scoreMin = asNum(value);
          break;
        case "cmi.core.score.max":
        case "cmi.score.max":
          s.scoreMax = asNum(value);
          break;
        case "cmi.score.scaled":
          s.scoreScaled = asNum(value);
          break;
        case "cmi.core.session_time":
        case "cmi.session_time":
          sessionSecondsRef.current = parseScormTime(value);
          break;
        case "cmi.core.exit":
        case "cmi.exit":
          exitRef.current = value;
          break;
        default:
          extraRef.current[element] = value;
      }
      schedulePersist();
      checkComplete();
      refreshDisplay();
      return "true";
    };

    const initialize = (v2004: boolean): string => {
      if (initializedRef.current) {
        lastErrorRef.current = v2004 ? "103" : "101";
        return "false";
      }
      initializedRef.current = true;
      lastErrorRef.current = "0";
      sessionStartRef.current = Date.now();
      sessionSecondsRef.current = 0;
      const s = stateRef.current;
      if (s.lessonStatus === "not attempted") s.lessonStatus = "incomplete";
      if (s.completionStatus === "unknown" || s.completionStatus === "not attempted") {
        s.completionStatus = "incomplete";
      }
      setIsLoading(false);
      refreshDisplay();
      return "true";
    };

    const finish = (v2004: boolean): string => {
      if (!initializedRef.current) {
        lastErrorRef.current = v2004 ? "112" : "301";
        return "false";
      }
      checkComplete();
      // A completed attempt that didn't ask to be suspended starts fresh next
      // time. Incomplete attempts keep their bookmark either way: losing a
      // learner's place is worse than an extra resume.
      if (isScormComplete(stateRef.current) && exitRef.current !== "suspend") {
        stateRef.current.location = "";
        stateRef.current.suspendData = "";
      }
      dirtyRef.current = true;
      persist(false);
      // Fold this session into the stored total so a re-Initialize in the
      // same page view doesn't double count.
      stateRef.current.totalTimeSeconds += sessionSecondsRef.current > 0
        ? sessionSecondsRef.current
        : sessionStartRef.current
          ? (Date.now() - sessionStartRef.current) / 1000
          : 0;
      sessionSecondsRef.current = 0;
      sessionStartRef.current = null;
      initializedRef.current = false;
      lastErrorRef.current = "0";
      refreshDisplay();
      return "true";
    };

    const commit = (v2004: boolean): string => {
      if (!initializedRef.current) {
        lastErrorRef.current = v2004 ? "142" : "301";
        return "false";
      }
      lastErrorRef.current = "0";
      dirtyRef.current = true;
      // Throttled: some packages commit after every single SetValue.
      schedulePersist();
      return "true";
    };

    const errorString = (code: string) =>
      ({
        "0": "No Error",
        "101": "General Exception",
        "103": "Already Initialized",
        "112": "Termination Before Initialization",
        "122": "Retrieve Data Before Initialization",
        "132": "Store Data Before Initialization",
        "142": "Commit Before Initialization",
        "201": "Invalid Argument Error",
        "301": "Not Initialized",
        "401": "Not Implemented Error",
        "404": "Element Is Write Only",
        "405": "Element Is Write Only",
      })[code] ?? "Unknown Error";

    const api12: Api = {
      LMSInitialize: () => initialize(false),
      LMSFinish: () => finish(false),
      LMSGetValue: (el) => getValue(el, false),
      LMSSetValue: (el, v) => setValue(el, v, false),
      LMSCommit: () => commit(false),
      LMSGetLastError: () => lastErrorRef.current,
      LMSGetErrorString: (c) => errorString(String(c)),
      LMSGetDiagnostic: (c) => errorString(String(c || lastErrorRef.current)),
    };
    const api2004: Api = {
      Initialize: () => initialize(true),
      Terminate: () => finish(true),
      GetValue: (el) => getValue(el, true),
      SetValue: (el, v) => setValue(el, v, true),
      Commit: () => commit(true),
      GetLastError: () => lastErrorRef.current,
      GetErrorString: (c) => errorString(String(c)),
      GetDiagnostic: (c) => errorString(String(c || lastErrorRef.current)),
    };

    const w = window as unknown as Record<string, unknown>;
    w.API = api12;
    w.API_1484_11 = api2004;

    const onUnload = () => {
      if (initializedRef.current || dirtyRef.current) persist(true);
    };
    window.addEventListener("pagehide", onUnload);

    return () => {
      window.removeEventListener("pagehide", onUnload);
      // Switching lessons unmounts the player without unloading the page.
      if (initializedRef.current || dirtyRef.current) persist(true);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      if (w.API === api12) delete w.API;
      if (w.API_1484_11 === api2004) delete w.API_1484_11;
    };
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const complete = display.status === "completed" || display.status === "passed";
  const statusColor = complete
    ? "text-green-600"
    : display.status === "failed"
      ? "text-red-600"
      : display.status === "incomplete"
        ? "text-amber-600"
        : "text-gray-500";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white",
        isFullscreen && "fixed inset-0 z-[9999] rounded-none border-none",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Loading...
            </span>
          )}
          {display.status && (
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium capitalize", statusColor)}>
              {complete ? <CheckCircle className="h-3 w-3" aria-hidden="true" /> : null}
              {display.status.replace(/[_-]/g, " ")}
              {display.score !== null && ` (${display.score}%)`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (iframeRef.current) {
                iframeRef.current.src = src;
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

      <div className={cn("relative flex-1", fill && "min-h-0")}>
        <iframe
          ref={iframeRef}
          src={src}
          title={`SCORM content: ${title}`}
          className={cn("h-full w-full border-none", fill && "absolute inset-0")}
          style={fill ? undefined : { minHeight: isFullscreen ? "100%" : "600px" }}
          allow="fullscreen; autoplay"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}
