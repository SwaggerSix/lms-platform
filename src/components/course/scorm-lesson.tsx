"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Loader2, Eye } from "lucide-react";
import type { ScormRuntimeState } from "@/lib/scorm/package";

const SCORMPlayer = dynamic(() => import("./scorm-player").then((m) => m.SCORMPlayer), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[600px] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  ),
});

interface ScormLessonProps {
  lessonId: string;
  title: string;
  packageUrl: string;
  enrollmentId: string | null;
  learnerName: string;
  learnerId: string;
  alreadyCompleted: boolean;
  onComplete: () => void;
}

/**
 * Loads the learner's saved SCORM state before launching (packages read their
 * resume data during Initialize, so it has to be ready first), and saves it
 * back as the package commits. Without an enrollment (an admin previewing a
 * course) it runs as a preview: everything works, nothing is recorded.
 */
export default function ScormLesson({
  lessonId,
  title,
  packageUrl,
  enrollmentId,
  learnerName,
  learnerId,
  alreadyCompleted,
  onComplete,
}: ScormLessonProps) {
  const [state, setState] = useState<ScormRuntimeState | null | undefined>(enrollmentId ? undefined : null);

  useEffect(() => {
    if (!enrollmentId) return;
    let cancelled = false;
    fetch(`/api/scorm/runtime?enrollment_id=${enrollmentId}&lesson_id=${lessonId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { state: null }))
      .then((d) => !cancelled && setState(d.state ?? null))
      .catch(() => !cancelled && setState(null));
    return () => {
      cancelled = true;
    };
  }, [enrollmentId, lessonId]);

  const persist = useCallback(
    (s: ScormRuntimeState, final: boolean) => {
      if (!enrollmentId) return;
      const body = JSON.stringify({ enrollment_id: enrollmentId, lesson_id: lessonId, state: s });
      if (final && typeof navigator !== "undefined" && navigator.sendBeacon) {
        const ok = navigator.sendBeacon("/api/scorm/runtime", new Blob([body], { type: "text/plain;charset=UTF-8" }));
        if (ok) return;
      }
      fetch("/api/scorm/runtime", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: final && body.length < 60000,
      }).catch(() => {});
    },
    [enrollmentId, lessonId]
  );

  if (state === undefined) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      {!enrollmentId && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <Eye className="h-3.5 w-3.5" />
          Preview mode — you aren&apos;t enrolled, so completion, score and resume position are not saved.
        </div>
      )}
      <SCORMPlayer
        packageUrl={packageUrl}
        title={title}
        learnerName={learnerName}
        learnerId={learnerId}
        initialState={state}
        alreadyCompleted={alreadyCompleted}
        onComplete={() => {
          if (enrollmentId) onComplete();
        }}
        onPersist={persist}
        className="min-h-[600px]"
      />
    </div>
  );
}
