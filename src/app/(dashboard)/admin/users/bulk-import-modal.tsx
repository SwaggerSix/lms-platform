"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload, Loader2, Download, X, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/utils/cn";

interface ParsedRow {
  rowIndex: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
  job_title: string;
  rawError?: string;
}

interface ResultRow {
  rowIndex: number;
  email: string;
  status: "created" | "skipped" | "failed" | "enrollment_partial";
  userId?: string;
  temporaryPassword?: string;
  welcomeEmailSent?: boolean;
  welcomeEmailError?: string;
  message?: string;
  enrolledCourseCount?: number;
  enrollmentErrors?: string[];
}

interface CourseOption {
  id: string;
  title: string;
}

interface OrgOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
  organizations: OrgOption[];
}

const VALID_ROLES = ["admin", "manager", "instructor", "learner"];
const HEADER_ALIASES: Record<string, keyof Omit<ParsedRow, "rowIndex" | "rawError">> = {
  email: "email",
  "email address": "email",
  first_name: "first_name",
  firstname: "first_name",
  "first name": "first_name",
  last_name: "last_name",
  lastname: "last_name",
  "last name": "last_name",
  role: "role",
  organization_id: "organization_id",
  "organization id": "organization_id",
  org_id: "organization_id",
  department_id: "organization_id",
  job_title: "job_title",
  "job title": "job_title",
  title: "job_title",
};

function parseCsv(text: string): { rows: string[][]; error?: string } {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(cell);
      cell = "";
      // Treat any combination of CR/LF as a single newline
      if (ch === "\r" && text[i + 1] === "\n") i++;
      i++;
      if (row.length > 1 || row[0]?.trim() !== "") rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
    i++;
  }
  // Flush trailing cell/row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0]?.trim() !== "") rows.push(row);
  }
  return { rows };
}

function parseRowsFromCsv(text: string): { rows: ParsedRow[]; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [] };
  const { rows: raw } = parseCsv(trimmed);
  if (raw.length === 0) return { rows: [], error: "No rows found" };

  const header = raw[0].map((h) => h.trim().toLowerCase());
  const colIndex: Partial<Record<keyof Omit<ParsedRow, "rowIndex" | "rawError">, number>> = {};
  header.forEach((h, idx) => {
    const key = HEADER_ALIASES[h];
    if (key) colIndex[key] = idx;
  });
  if (colIndex.email === undefined) {
    return { rows: [], error: 'CSV must include an "email" column.' };
  }

  const parsed: ParsedRow[] = [];
  for (let r = 1; r < raw.length; r++) {
    const cells = raw[r];
    const get = (k: keyof Omit<ParsedRow, "rowIndex" | "rawError">) => {
      const idx = colIndex[k];
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };
    const email = get("email");
    if (!email) continue;
    parsed.push({
      rowIndex: r,
      email,
      first_name: get("first_name"),
      last_name: get("last_name"),
      role: get("role") || "learner",
      organization_id: get("organization_id"),
      job_title: get("job_title"),
    });
  }
  return { rows: parsed };
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportModal({ open, onClose, onCompleted, organizations }: Props) {
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [includePasswordsInCsv, setIncludePasswordsInCsv] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCsvText("");
    setParsedRows([]);
    setParseError(null);
    setSelectedCourseIds([]);
    setSendWelcomeEmail(true);
    setIncludePasswordsInCsv(false);
    setResults(null);
    setServerError(null);
    // Lazy load published courses for enrollment selection
    fetch("/api/courses?status=published&limit=200")
      .then((res) => res.ok ? res.json() : { courses: [] })
      .then((body) => {
        const list = (body.courses ?? []) as Array<{ id: string; title: string }>;
        setCourses(list.map((c) => ({ id: c.id, title: c.title })));
      })
      .catch(() => setCourses([]));
  }, [open]);

  const validRows = useMemo(() => parsedRows.filter((r) => r.email), [parsedRows]);
  const invalidPreviewRows = useMemo(
    () => parsedRows.filter((r) => !r.email || !r.first_name || !r.last_name || (r.role && !VALID_ROLES.includes(r.role.toLowerCase()))),
    [parsedRows]
  );

  const handleParse = (text: string) => {
    setCsvText(text);
    setResults(null);
    setServerError(null);
    if (!text.trim()) {
      setParsedRows([]);
      setParseError(null);
      return;
    }
    const { rows, error } = parseRowsFromCsv(text);
    setParsedRows(rows);
    setParseError(error ?? null);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    handleParse(text);
  };

  const downloadTemplate = () => {
    downloadCsv(
      "user-import-template.csv",
      ["email", "first_name", "last_name", "role", "organization_id", "job_title"],
      [
        ["jane@example.com", "Jane", "Doe", "learner", "", ""],
        ["bob@example.com", "Bob", "Smith", "manager", "", ""],
      ]
    );
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          users: validRows.map((r) => ({
            email: r.email,
            first_name: r.first_name,
            last_name: r.last_name,
            role: r.role || "learner",
            organization_id: r.organization_id || undefined,
            job_title: r.job_title || undefined,
          })),
          enroll_in_course_ids: selectedCourseIds,
          send_welcome_email: sendWelcomeEmail,
          include_passwords_in_response: includePasswordsInCsv,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Import failed");
      }
      setResults(body.results);
      onCompleted();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  const exportResults = () => {
    if (!results) return;
    const headers = ["Row", "Email", "Status", "User ID", "Welcome Email", "Enrolled Courses", "Message"];
    if (includePasswordsInCsv) headers.splice(4, 0, "Temp Password");
    const rows = results.map((r) => {
      const base: (string | number)[] = [
        r.rowIndex,
        r.email,
        r.status,
        r.userId ?? "",
      ];
      if (includePasswordsInCsv) base.push(r.temporaryPassword ?? "");
      base.push(
        r.welcomeEmailSent === undefined
          ? "not sent"
          : r.welcomeEmailSent
            ? "sent"
            : `failed: ${r.welcomeEmailError ?? "unknown"}`,
        r.enrolledCourseCount ?? 0,
        r.message ?? (r.enrollmentErrors?.join("; ") ?? "")
      );
      return base;
    });
    downloadCsv(`user-import-results-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  if (!open) return null;

  const summary = results
    ? {
        created: results.filter((r) => r.status === "created" || r.status === "enrollment_partial").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        failed: results.filter((r) => r.status === "failed").length,
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-xl bg-white shadow-xl my-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Bulk import users"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk Import Users</h2>
            <p className="mt-0.5 text-sm text-gray-500">Paste or upload a CSV. Optionally enroll all imported users in selected courses.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close import dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {!results && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  Upload CSV file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </label>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Download className="h-4 w-4" />
                  Download template
                </button>
                <span className="text-xs text-gray-400">Required columns: email, first_name, last_name. Optional: role, organization_id, job_title.</span>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Or paste CSV directly</label>
                <textarea
                  value={csvText}
                  onChange={(e) => handleParse(e.target.value)}
                  rows={6}
                  placeholder={"email,first_name,last_name,role\njane@example.com,Jane,Doe,learner"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {parseError && (
                  <p className="mt-1 text-sm text-red-600">{parseError}</p>
                )}
              </div>

              {parsedRows.length > 0 && (
                <div className="rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
                    <p className="text-sm font-medium text-gray-700">
                      Preview · {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} parsed
                      {invalidPreviewRows.length > 0 && (
                        <span className="ml-2 text-amber-700">
                          ({invalidPreviewRows.length} need attention)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-xs">
                      <thead className="bg-white">
                        <tr className="text-left text-gray-500">
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">First</th>
                          <th className="px-3 py-2 font-medium">Last</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium">Org ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {parsedRows.slice(0, 50).map((r) => {
                          const roleValid = !r.role || VALID_ROLES.includes(r.role.toLowerCase());
                          const issues = !r.first_name || !r.last_name || !roleValid;
                          return (
                            <tr key={r.rowIndex} className={cn(issues && "bg-amber-50")}>
                              <td className="px-3 py-2 text-gray-900">{r.email}</td>
                              <td className="px-3 py-2 text-gray-700">{r.first_name || <span className="text-red-600">missing</span>}</td>
                              <td className="px-3 py-2 text-gray-700">{r.last_name || <span className="text-red-600">missing</span>}</td>
                              <td className="px-3 py-2 text-gray-700">
                                {roleValid ? r.role : <span className="text-red-600">invalid: {r.role}</span>}
                              </td>
                              <td className="px-3 py-2 text-gray-700">{r.organization_id || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {parsedRows.length > 50 && (
                      <p className="px-3 py-2 text-xs text-gray-500">…and {parsedRows.length - 50} more</p>
                    )}
                  </div>
                </div>
              )}

              {courses.length > 0 && parsedRows.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Auto-enroll imported users in courses</p>
                  <p className="mt-0.5 text-xs text-gray-500">Optional. Selected courses will be assigned to every imported user (and existing users matched by email).</p>
                  <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                    {courses.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCourseIds.includes(c.id)}
                          onChange={() => toggleCourse(c.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-gray-800">{c.title}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCourseIds.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">{selectedCourseIds.length} course{selectedCourseIds.length === 1 ? "" : "s"} selected</p>
                  )}
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-900">Credential delivery</p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendWelcomeEmail}
                      onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      Email each new user a welcome message with their temporary password
                      <span className="block text-xs text-gray-500">Default. Each learner gets their own credentials via email and is required to change the password on first login.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePasswordsInCsv}
                      onChange={(e) => setIncludePasswordsInCsv(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      Also include temporary passwords in the downloadable results CSV
                      <span className="block text-xs text-amber-700">
                        Only enable if you need to distribute credentials yourself (e.g. email is not configured). The CSV will contain plaintext passwords — handle and store accordingly.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {organizations.length > 0 && (
                <details className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-gray-700">
                    <FileText className="inline h-4 w-4 mr-1 text-gray-400" />
                    Organization IDs reference
                  </summary>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1 text-xs">
                    {organizations.map((o) => (
                      <div key={o.id} className="flex items-center gap-2">
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{o.id}</code>
                        <span className="text-gray-600">{o.name}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {serverError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
              )}
            </>
          )}

          {results && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-green-700">Created</p>
                  <p className="mt-1 text-2xl font-bold text-green-700">{summary.created}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Skipped</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">{summary.skipped}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-red-700">Failed</p>
                  <p className="mt-1 text-2xl font-bold text-red-700">{summary.failed}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="max-h-72 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="text-left text-gray-500">
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Welcome email</th>
                        <th className="px-3 py-2 font-medium">Enrolled</th>
                        <th className="px-3 py-2 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {results.map((r) => (
                        <tr key={r.rowIndex} className="align-top">
                          <td className="px-3 py-2 text-gray-900">{r.email}</td>
                          <td className="px-3 py-2">
                            {r.status === "failed" ? (
                              <span className="inline-flex items-center gap-1 text-red-700">
                                <AlertCircle className="h-3.5 w-3.5" /> failed
                              </span>
                            ) : r.status === "skipped" ? (
                              <span className="inline-flex items-center gap-1 text-amber-700">skipped</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> created
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {r.welcomeEmailSent === undefined ? (
                              <span className="text-gray-400">—</span>
                            ) : r.welcomeEmailSent ? (
                              <span className="text-green-700">sent</span>
                            ) : (
                              <span className="text-red-700" title={r.welcomeEmailError}>failed</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{r.enrolledCourseCount ?? 0}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {r.message || r.enrollmentErrors?.join("; ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
                {includePasswordsInCsv ? (
                  <>The CSV export below includes one-time temporary passwords for each newly created account. Handle securely — store and share only as needed.</>
                ) : (
                  <>Temporary passwords were delivered directly to each new user via the welcome email. The CSV export below summarizes import status only.</>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          {results ? (
            <>
              <button
                onClick={exportResults}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" /> Download results CSV
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || validRows.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {validRows.length || ""} user{validRows.length === 1 ? "" : "s"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
