"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, ExternalLink, RefreshCcw } from "lucide-react";
import { cn } from "@/utils/cn";

const TEMPLATES: { key: string; label: string; category: string }[] = [
  { key: "enrollment_confirmation", label: "Enrollment Confirmation", category: "Enrollment" },
  { key: "approval_request", label: "Approval Request", category: "Approvals" },
  { key: "approval_decision", label: "Approval Decision", category: "Approvals" },
  { key: "course_completion", label: "Course Completion", category: "Completion" },
  { key: "certification_expiry", label: "Certification Expiry", category: "Compliance" },
  { key: "recertification_reminder", label: "Recertification Reminder", category: "Compliance" },
  { key: "due_date_reminder", label: "Due Date Reminder", category: "Reminders" },
  { key: "ilt_session_reminder", label: "ILT Session Reminder", category: "Reminders" },
  { key: "scheduled_report", label: "Scheduled Report Delivery", category: "Reports" },
];

export default function PreviewClient() {
  const [selected, setSelected] = useState<string>(TEMPLATES[0].key);
  const [subject, setSubject] = useState<string>("");
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, typeof TEMPLATES>();
    for (const t of TEMPLATES) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return Array.from(map.entries());
  }, []);

  const loadPreview = async (templateKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/email?template=${templateKey}&preview=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSubject(json.subject ?? "");
      setHtml(json.html ?? "");
    } catch (err: any) {
      setError(err?.message ?? "Failed to load preview");
      setHtml("");
      setSubject("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview(selected);
  }, [selected]);

  const externalHref = `/api/email?template=${selected}&preview=html`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Mail className="h-6 w-6 text-indigo-600" />
              Email Template Previews
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Inspect every transactional email template with sample data. Renders inline using
              {" "}<code className="rounded bg-gray-100 px-1 text-xs">GET /api/email?preview=true</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadPreview(selected)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Re-fetch the preview"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {/* Template list */}
          <aside className="space-y-4">
            {categories.map(([category, templates]) => (
              <div key={category}>
                <p className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{category}</p>
                <div className="mt-1 space-y-0.5">
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSelected(t.key)}
                      className={cn(
                        "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        selected === t.key
                          ? "bg-indigo-50 font-medium text-indigo-700"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          {/* Preview pane */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-gray-500">Subject</p>
                <p className="truncate text-sm font-semibold text-gray-900">
                  {loading ? "Loading…" : subject || "—"}
                </p>
              </div>
              <a
                href={externalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in new tab
              </a>
            </header>
            <div className="bg-white">
              {error ? (
                <div className="p-8 text-center text-sm text-red-600">
                  {error}
                </div>
              ) : loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Rendering…</div>
              ) : (
                <iframe
                  title={`Preview of ${selected}`}
                  srcDoc={html}
                  className="h-[640px] w-full border-0"
                  sandbox="allow-same-origin"
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
