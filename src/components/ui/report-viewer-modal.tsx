"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Download, Printer, Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ReportColumn<Row> {
  /** Column key — should match a key on the row object */
  key: keyof Row & string;
  /** Header label displayed to the user */
  label: string;
  /** Optional cell renderer; falls back to `String(row[key])` */
  render?: (row: Row) => React.ReactNode;
  /** Optional alignment hint */
  align?: "left" | "center" | "right";
  /** Disable sorting on this column */
  unsortable?: boolean;
}

export interface ReportViewerModalProps<Row extends Record<string, unknown>> {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  rows: Row[];
  columns: ReportColumn<Row>[];
  /** Default rows per page (default 50) */
  pageSize?: number;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toCSV<Row extends Record<string, unknown>>(rows: Row[], columns: ReportColumn<Row>[]): string {
  const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const v = row[c.key];
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...body].join("\n");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportViewerModal<Row extends Record<string, unknown>>({
  open,
  onClose,
  title,
  subtitle,
  rows,
  columns,
  pageSize = 50,
}: ReportViewerModalProps<Row>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(q))
    );
  }, [rows, columns, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (col: ReportColumn<Row>) => {
    if (col.unsortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  const handleCSV = () => {
    const csv = toCSV(sorted, columns);
    downloadBlob(csv, `${title.replace(/\s+/g, "_")}.csv`, "text/csv");
  };

  const handlePrint = () => {
    const headerRow = columns
      .map(
        (c) =>
          `<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:${c.align ?? "left"}">${escapeHtml(c.label)}</th>`
      )
      .join("");
    const bodyRows = sorted
      .map((row) => {
        const cells = columns
          .map((c) => {
            const v = row[c.key];
            const s = v == null ? "" : String(v);
            return `<td style="border:1px solid #ddd;padding:8px;text-align:${c.align ?? "left"}">${escapeHtml(s)}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%;font-size:12px}h1{color:#333;margin-bottom:4px}p.meta{color:#666;font-size:12px;margin-top:0}</style></head><body><h1>${escapeHtml(title)}</h1><p class="meta">Generated ${new Date().toLocaleString()} · ${sorted.length} rows</p><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-viewer-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div className="min-w-0">
            <h2 id="report-viewer-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
            <p className="mt-1 text-xs text-gray-500">
              {sorted.length.toLocaleString()} {sorted.length === 1 ? "row" : "rows"}
              {search && rows.length !== sorted.length ? ` (filtered from ${rows.length.toLocaleString()})` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report viewer"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rows…"
              className="w-64 rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {sorted.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center p-8 text-sm text-gray-500">
              {rows.length === 0 ? "No data to display." : "No rows match your search."}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  {columns.map((c) => {
                    const isSorted = sortKey === c.key;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        className={cn(
                          "px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          (!c.align || c.align === "left") && "text-left",
                          !c.unsortable && "cursor-pointer select-none hover:text-gray-700"
                        )}
                        onClick={() => handleSort(c)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {c.label}
                          {isSorted && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-6 py-3 text-sm text-gray-700",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center"
                        )}
                      >
                        {c.render ? c.render(row) : (row[c.key] == null ? "—" : String(row[c.key]))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / pagination */}
        {sorted.length > pageSize && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportViewerModal;
