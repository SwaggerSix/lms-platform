"use client";

import { useState, useRef } from "react";
import { UploadCloud, Loader2, CheckCircle2, Package, AlertTriangle } from "lucide-react";
import { MAX_ZIP_BYTES, toPlayableScormUrl } from "@/lib/scorm/package";
import { uploadScormPackage, type ScormImportResult, type ScormImportTarget } from "@/lib/scorm/client-upload";

interface ScormUploadProps {
  /** Replace this lesson's package. */
  lessonId?: string;
  /** Add a new SCORM lesson to this course (ignored when lessonId is set). */
  courseId?: string;
  /** Title for a newly created course / lesson. */
  title?: string;
  /** Current SCORM launch URL, if the lesson already has one. */
  initialUrl?: string | null;
  /** Heading override. */
  heading?: string;
  /** Hide the heading/description chrome (for use inside cards/modals). */
  bare?: boolean;
  disabled?: boolean;
  onUploaded?: (result: ScormImportResult) => void;
}

const MAX_MB = Math.round(MAX_ZIP_BYTES / 1024 / 1024);

export default function ScormUpload({
  lessonId,
  courseId,
  title,
  initialUrl,
  heading = "SCORM Package (e-learning)",
  bare = false,
  disabled = false,
  onUploaded,
}: ScormUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">(
    initialUrl ? "done" : "idle"
  );
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string | null>(initialUrl ? toPlayableScormUrl(initialUrl) : null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ScormImportResult | null>(null);

  const busy = status === "uploading" || status === "processing";

  const upload = async (file: File) => {
    setFileName(file.name);
    setError(null);
    setPct(0);
    setStatus("uploading");
    const target: ScormImportTarget = lessonId ? { lessonId } : { courseId, title };
    try {
      const r = await uploadScormPackage(file, target, (phase, p) => {
        setStatus(phase);
        if (typeof p === "number") setPct(p);
      });
      setResult(r);
      setLaunchUrl(r.launchUrl);
      setStatus("done");
      onUploaded?.(r);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const zone = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-disabled={busy || disabled}
        onClick={() => !busy && !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (busy || disabled) return;
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        {status === "uploading" ? (
          <div className="w-full max-w-xs">
            <p className="text-sm text-gray-600">Uploading {fileName}… {pct}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : status === "processing" ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            <p className="mt-2 text-sm text-gray-600">Unpacking and publishing files… this can take a minute for large courses.</p>
          </>
        ) : status === "done" ? (
          <>
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="mt-2 text-sm font-medium text-gray-700">SCORM package ready</p>
            {result && (
              <p className="mt-0.5 text-xs text-gray-500">
                {result.version === "unknown" ? "No manifest version detected" : `SCORM ${result.version}`} ·{" "}
                {result.fileCount} files
              </p>
            )}
            {launchUrl && (
              <a
                href={launchUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-1 text-xs text-primary-600 hover:underline"
              >
                Open raw package in a new tab (no tracking)
              </a>
            )}
            <p className="mt-1 text-xs text-gray-400">Click or drop a new .zip to replace it</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">Click to choose or drag a .zip SCORM package here</p>
            <p className="text-xs text-gray-400">SCORM 1.2 or 2004 · max {MAX_MB}MB</p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </>
  );

  if (bare) return <div>{zone}</div>;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <Package className="h-4 w-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Upload a SCORM package (.zip) exported from your authoring tool. It&apos;s unpacked and set as this
        lesson&apos;s content; learners launch it in the course player and completion is tracked automatically.
      </p>
      {zone}
    </div>
  );
}
