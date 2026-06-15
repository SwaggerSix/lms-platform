"use client";

import { useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";

interface Result { updated: number; skipped: number; total_rows: number; errors: string[] }

export default function CatalogImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/import-audit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      setResult(data);
    } catch {
      setError("Something went wrong uploading the file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Catalog Content Import</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload the completed GGS catalog audit (.xlsx). Each product is matched by its Product ID; only
        filled-in cells are applied — blanks never overwrite existing content, and the description preview
        column is ignored.
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-6">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
          <FileSpreadsheet className="h-10 w-10 text-indigo-400" />
          <span className="text-sm font-medium text-gray-700">
            {file ? file.name : "Choose the completed audit spreadsheet"}
          </span>
          <span className="text-xs text-gray-400">.xlsx</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
          />
        </label>
      </div>

      <button
        onClick={submit}
        disabled={!file || uploading}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Import content
      </button>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-green-800">
            <CheckCircle2 className="h-4 w-4" /> Import complete
          </p>
          <ul className="mt-2 space-y-0.5 text-green-700">
            <li><strong>{result.updated}</strong> products updated</li>
            <li><strong>{result.skipped}</strong> rows skipped (no new content or no valid ID)</li>
            <li>{result.total_rows} rows read</li>
          </ul>
          {result.errors.length > 0 && (
            <div className="mt-2 text-red-700">
              <p className="font-medium">Errors:</p>
              <ul className="list-disc pl-5">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
