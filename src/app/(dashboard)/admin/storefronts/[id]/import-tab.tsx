"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

interface ImportTabProps {
  storeId: string;
  onReload: () => Promise<void>;
}

export default function ImportTab({ storeId, onReload }: ImportTabProps) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function handleImport(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch(`/api/storefront/admin/${storeId}/import`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult(`Import failed: ${data.error}`);
        return;
      }
      const parts = [
        `${data.created} added`,
        `${data.updated} updated`,
        ...(data.skipped?.length ? [`${data.skipped.length} skipped`] : []),
        ...(data.errors?.length ? [`${data.errors.length} errors`] : []),
      ];
      setImportResult(`Done — ${parts.join(", ")}.`);
      await onReload();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-semibold text-lg">Import your existing catalog</h2>
      <p className="mt-2 text-sm text-gray-600">
        Bring your whole catalog over from your current store in one step:
      </p>
      <ol className="mt-3 text-sm text-gray-600 list-decimal list-inside space-y-1.5">
        <li>
          In your current store&apos;s admin (Ecwid: <em>Catalog → Products → Export</em>;
          Shopify: <em>Products → Export</em>), export your products as a <strong>CSV file</strong>.
        </li>
        <li>Upload that file below. Products are matched by name/SKU, so re-importing updates rather than duplicates.</li>
        <li>Review the products in the Products tab and tidy up anything that needs it.</li>
      </ol>
      <label className="mt-6 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
        <Upload className="h-7 w-7 text-gray-400" />
        <span className="text-sm font-medium">
          {importing ? "Importing…" : "Click to choose your CSV file"}
        </span>
        <span className="text-xs text-gray-500">Ecwid, Shopify, or spreadsheet exports (max 5 MB)</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={importing}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
      </label>
      {importResult && (
        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 text-sm">
          {importResult}
        </div>
      )}
    </div>
  );
}
