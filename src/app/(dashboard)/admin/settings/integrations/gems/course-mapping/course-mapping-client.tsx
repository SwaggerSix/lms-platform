"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  course_type: string | null;
  status: string | null;
  gems_course_code: string | null;
}

interface CatalogRow {
  course_product_id: number;
  product_code: string;
  product_description: string;
}

interface Props {
  initialCourses: CourseRow[];
}

/**
 * Score how well a GEMS catalog entry matches an LMS course title.
 * Returns 0–1 where 1 is a perfect match.
 *
 * Strategy: heavy weight when the productCode appears anywhere in the LMS
 * title (case-insensitive); softer signal from word overlap on the
 * productDescription. Cheap, deterministic, no external deps.
 */
function similarityScore(title: string, c: CatalogRow): number {
  const t = title.toLowerCase();
  const code = c.product_code.toLowerCase();
  let score = 0;
  if (code && t.includes(code)) score += 0.7;
  const titleTokens = new Set(t.split(/[^a-z0-9]+/).filter(Boolean));
  const descTokens = c.product_description.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (descTokens.length > 0) {
    const overlap = descTokens.filter((tok) => titleTokens.has(tok)).length;
    score += (overlap / descTokens.length) * 0.3;
  }
  return Math.min(score, 1);
}

function suggestMatch(title: string, catalog: CatalogRow[]): CatalogRow | null {
  let best: { c: CatalogRow; score: number } | null = null;
  for (const c of catalog) {
    const score = similarityScore(title, c);
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { c, score };
    }
  }
  return best?.c ?? null;
}

export default function CourseMappingClient({ initialCourses }: Props) {
  const [courses] = useState<CourseRow[]>(initialCourses);
  const [catalog, setCatalog] = useState<CatalogRow[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [mappings, setMappings] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initialCourses.map((c) => [c.id, c.gems_course_code]))
  );
  const [filter, setFilter] = useState("");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/integrations/gems/catalog");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setCatalogError(data.error ?? `Catalog fetch failed (${res.status})`);
          setCatalogLoading(false);
          return;
        }
        setCatalog(data.catalog ?? []);
        setCatalogLoading(false);
      } catch (err) {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : "Catalog fetch failed");
          setCatalogLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-suggest matches once the catalog arrives, but only for courses
  // that don't already have a saved mapping.
  useEffect(() => {
    if (!catalog) return;
    setMappings((prev) => {
      const next = { ...prev };
      for (const c of courses) {
        if (next[c.id]) continue; // existing mapping wins
        const suggestion = suggestMatch(c.title, catalog);
        if (suggestion) next[c.id] = suggestion.product_code;
      }
      return next;
    });
  }, [catalog, courses]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return courses.filter((c) => {
      if (showUnmappedOnly && mappings[c.id]) return false;
      if (!f) return true;
      return c.title.toLowerCase().includes(f) || (mappings[c.id] ?? "").toLowerCase().includes(f);
    });
  }, [courses, filter, showUnmappedOnly, mappings]);

  const mappedCount = courses.filter((c) => mappings[c.id]).length;

  const dirtyIds = useMemo(
    () =>
      courses
        .filter((c) => (mappings[c.id] ?? null) !== (c.gems_course_code ?? null))
        .map((c) => c.id),
    [courses, mappings]
  );

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    try {
      const payload = {
        mappings: dirtyIds.map((id) => ({
          course_id: id,
          product_code: mappings[id] || null,
        })),
      };
      const res = await fetch("/api/integrations/gems/course-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveResult(`Save failed: ${data.error ?? res.status}`);
      } else {
        setSaveResult(`Saved ${data.updated} mapping${data.updated === 1 ? "" : "s"}.`);
      }
    } catch (err) {
      setSaveResult(`Save failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <Link
          href="/admin/settings/integrations/hris"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Integrations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">GEMS Course Mapping</h1>
        <p className="mt-1 text-sm text-gray-600">
          Tag each existing LMS course with its GEMS course code. After saving, the next GEMS sync
          will match events to these courses instead of creating duplicates.
        </p>
      </div>

      {catalogError && (
        <div className="mb-4 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>Can&apos;t load GEMS catalog.</strong> {catalogError}
            <div className="mt-1 text-xs">
              Make sure the GEMS integration is configured and active under Settings → Integrations.
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search courses…"
            className="w-full rounded border border-gray-300 px-8 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showUnmappedOnly}
            onChange={(e) => setShowUnmappedOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Unmapped only
        </label>
        <span className="text-sm text-gray-500">
          {mappedCount} of {courses.length} mapped
        </span>
        <div className="ml-auto flex items-center gap-3">
          {saveResult && (
            <span className="inline-flex items-center gap-1 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> {saveResult}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || dirtyIds.length === 0 || !catalog}
            className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save {dirtyIds.length > 0 ? `(${dirtyIds.length})` : ""}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                LMS Course
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Type / Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                GEMS Course Code
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                  No courses match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const suggested = catalog ? suggestMatch(c.title, catalog) : null;
              const current = mappings[c.id] ?? "";
              const isSuggestion =
                !!suggested && current === suggested.product_code && !c.gems_course_code;
              return (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{c.title}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {c.course_type ?? "—"} · {c.status ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {catalogLoading ? (
                      <span className="text-xs text-gray-400">Loading…</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={current}
                          onChange={(e) =>
                            setMappings((prev) => ({
                              ...prev,
                              [c.id]: e.target.value || null,
                            }))
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">— Not mapped —</option>
                          {catalog?.map((cat) => (
                            <option key={cat.course_product_id} value={cat.product_code}>
                              {cat.product_code} — {cat.product_description}
                            </option>
                          ))}
                        </select>
                        {isSuggestion && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                            Suggested
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
