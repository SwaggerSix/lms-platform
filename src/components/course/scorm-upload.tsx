"use client";

import { useState, useRef } from "react";
import { UploadCloud, Loader2, CheckCircle2, Package } from "lucide-react";

interface ScormUploadProps {
  /** When set, the uploaded package is attached to this lesson as SCORM content. */
  lessonId?: string;
  /** Current SCORM launch URL, if the lesson already has one. */
  initialUrl?: string | null;
  onUploaded?: (launchUrl: string) => void;
}

export default function ScormUpload({ lessonId, initialUrl, onUploaded }: ScormUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    initialUrl ? "done" : "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string | null>(initialUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);

  const upload = async (file: File) => {
    setFileName(file.name);
    setStatus("uploading");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (lessonId) fd.append("lesson_id", lessonId);
      const res = await fetch("/api/scorm/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setLaunchUrl(data.launchUrl);
      setStatus("done");
      onUploaded?.(data.launchUrl);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <Package className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-900">SCORM Package (e-learning)</h3>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Upload a SCORM package (.zip). It&apos;s extracted and set as this
        lesson&apos;s content so learners can launch it in the course player.
      </p>

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
        onClick={() => status !== "uploading" && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (status === "uploading") return;
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40"
      >
        {status === "uploading" ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <p className="mt-2 text-sm text-gray-600">Extracting &amp; uploading {fileName}…</p>
          </>
        ) : status === "done" ? (
          <>
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="mt-2 text-sm font-medium text-gray-700">SCORM package ready</p>
            {launchUrl && (
              <a
                href={launchUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-1 text-xs text-indigo-600 hover:underline"
              >
                Preview launch file
              </a>
            )}
            <p className="mt-1 text-xs text-gray-400">Click to replace with a new package</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Click to choose or drag a .zip SCORM package here
            </p>
            <p className="text-xs text-gray-400">Max 100MB</p>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
