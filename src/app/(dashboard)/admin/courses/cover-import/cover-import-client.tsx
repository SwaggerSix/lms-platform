"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet,
  Download, ChevronLeft, ShieldCheck,
} from "lucide-react";

interface RowResult {
  row: number;
  course: string;
  status: "updated" | "skipped" | "error";
  detail: string;
  duplicates_updated?: number;
}
interface Result {
  total_rows: number;
  updated: number;
  duplicates_updated: number;
  skipped: number;
  errors: number;
  results: RowResult[];
}

const TEMPLATE_HEADERS = ["course_id", "slug", "image_url", "filename", "source_name", "license", "attribution", "origin"];
const TEMPLATE_SAMPLE = [
  "", "introduction-to-leadership", "https://images.example.com/leadership.jpg", "",
  "Unsplash", "CC0", "", "cc0",
];
const TEMPLATE_SAMPLE_FILE = [
  "", "ethics-and-compliance", "", "ethics.png",
  "AI-generated", "Original (AI-generated)", "", "original_ai",
];

export default function CoverImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [applyDuplicates, setApplyDuplicates] = useState(true);
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(",") + "\n"
      + TEMPLATE_SAMPLE.map((c) => `"${c}"`).join(",") + "\n"
      + TEMPLATE_SAMPLE_FILE.map((c) => `"${c}"`).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "course-cover-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("applyDuplicates", applyDuplicates ? "true" : "false");
      images.forEach((img) => fd.append("images", img));
      const res = await fetch("/api/courses/cover-import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Import failed."); return; }
      setResult(data);
    } catch {
      setError("Something went wrong uploading the file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Back to courses
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Bulk Course Cover Images</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload a spreadsheet (.xlsx or .csv) that points each course at a public image URL. Each image is
        fetched, validated, stored, and set as the course cover — along with its source and license, so we
        keep an audit trail proving every image is cleared for use.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Download className="h-4 w-4" /> Download template (.csv)
        </button>
        <a href="/api/courses/cover-log" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ShieldCheck className="h-4 w-4" /> Download current image log (.xlsx)
        </a>
      </div>

      <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700">Columns</p>
        <p className="mt-1">
          <code>course_id</code> (UUID) <em>or</em> <code>slug</code> to identify the course. For the image, give either an
          <code> image_url</code> (public http/https) <em>or</em> a <code>filename</code> that matches one of the image files you
          upload below. Plus <code>source_name</code>, <code>license</code>, <code>attribution</code>, <code>origin</code> for
          provenance. Only JPEG/PNG/WebP/GIF, under 5MB.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-6">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
          <FileSpreadsheet className="h-10 w-10 text-indigo-400" />
          <span className="text-sm font-medium text-gray-700">{file ? file.name : "Choose your spreadsheet"}</span>
          <span className="text-xs text-gray-400">.xlsx or .csv</span>
          <input
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
          />
        </label>
      </div>

      <div className="mt-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm hover:bg-gray-50">
          <Upload className="h-4 w-4 text-indigo-500" />
          <span className="font-medium text-gray-700">
            {images.length ? `${images.length} image file${images.length > 1 ? "s" : ""} attached` : "Attach image files (optional) — for rows that use a filename"}
          </span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => setImages(e.target.files ? Array.from(e.target.files) : [])}
          />
        </label>
        <p className="mt-1 text-xs text-gray-400">Rows with a <code>filename</code> use these; rows with an <code>image_url</code> are fetched from the web.</p>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={applyDuplicates} onChange={(e) => setApplyDuplicates(e.target.checked)} />
        Also apply each image to duplicate-titled courses (the mirrored GGS/gC copy)
      </label>

      <button
        onClick={submit}
        disabled={!file || uploading}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Import covers
      </button>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-green-800">
              <CheckCircle2 className="h-4 w-4" /> Import complete
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-green-700 sm:grid-cols-4">
              <li><strong>{result.updated}</strong> covers set</li>
              <li><strong>{result.duplicates_updated}</strong> duplicates updated</li>
              <li><strong>{result.skipped}</strong> blank rows</li>
              <li><strong>{result.errors}</strong> errors</li>
            </ul>
            <p className="mt-2 text-xs text-green-700">{result.total_rows} rows read.</p>
          </div>

          {result.results.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.results.map((r) => (
                    <tr key={r.row} className={r.status === "error" ? "bg-red-50/40" : undefined}>
                      <td className="px-3 py-2 text-gray-400">{r.row}</td>
                      <td className="px-3 py-2 text-gray-800">{r.course}</td>
                      <td className="px-3 py-2">
                        <span className={
                          r.status === "updated" ? "text-green-700"
                          : r.status === "error" ? "text-red-700" : "text-gray-500"
                        }>
                          {r.status}{r.duplicates_updated ? ` (+${r.duplicates_updated})` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
