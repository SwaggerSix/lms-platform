"use client";

import { MAX_ZIP_BYTES } from "./package";

export type UploadPhase = "uploading" | "processing";

export interface ScormImportResult {
  courseId: string;
  courseSlug: string;
  courseStatus: string;
  lessonId: string;
  launchUrl: string;
  createdCourse: boolean;
  version: "1.2" | "2004" | "unknown";
  manifestTitle: string | null;
  fileCount: number;
  totalBytes: number;
}

export interface ScormImportTarget {
  /** Replace this lesson's package. */
  lessonId?: string;
  /** Add a new SCORM lesson to this course. */
  courseId?: string;
  /** Course title (new course) or lesson title (added lesson). */
  title?: string;
}

async function readError(res: Response, fallback: string) {
  try {
    const d = await res.json();
    if (d?.error) return d.error as string;
  } catch {
    /* not JSON: the server process died or timed out */
  }
  if (res.status === 504) {
    return `${fallback} The server ran out of time unpacking the package. Try again; if it keeps happening, the package may be too large to import in one go.`;
  }
  if (res.status >= 500) {
    return `${fallback} The server stopped while unpacking the package (HTTP ${res.status}). Please try again, and report it if it repeats.`;
  }
  return `${fallback} (HTTP ${res.status})`;
}

/** PUT the file to the signed storage URL with progress (fetch can't report upload progress). */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText);
        const detail = body.message || body.error || "";
        if (/maximum allowed size|too large|exceeded/i.test(detail) || xhr.status === 413) {
          msg =
            "The file is larger than your storage upload limit. Raise it in Supabase → Storage → Settings (upload file size limit), then try again.";
        } else if (detail) {
          msg = `Upload failed: ${detail}`;
        }
      } catch {
        /* keep generic */
      }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and try again."));
    // Same shape supabase-js uploadToSignedUrl sends for a Blob.
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

/**
 * Upload a SCORM .zip directly to storage, then have the server extract it
 * and attach it to a lesson / course / new course.
 */
export async function uploadScormPackage(
  file: File,
  target: ScormImportTarget,
  onProgress: (phase: UploadPhase, pct?: number) => void
): Promise<ScormImportResult> {
  if (!/\.zip$/i.test(file.name)) throw new Error("Choose a .zip SCORM package.");
  if (file.size > MAX_ZIP_BYTES) {
    throw new Error(`SCORM package is too large (max ${Math.round(MAX_ZIP_BYTES / 1024 / 1024)}MB).`);
  }

  onProgress("uploading", 0);
  const urlRes = await fetch("/api/scorm/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: file.name, file_size: file.size }),
  });
  if (!urlRes.ok) throw new Error(await readError(urlRes, "Could not start the upload."));
  const { path, signedUrl } = (await urlRes.json()) as { path: string; signedUrl: string };

  await putWithProgress(signedUrl, file, (pct) => onProgress("uploading", pct));

  onProgress("processing");
  const res = await fetch("/api/scorm/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_path: path,
      file_name: file.name,
      lesson_id: target.lessonId,
      course_id: target.courseId,
      title: target.title,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Import failed."));
  return (await res.json()) as ScormImportResult;
}
