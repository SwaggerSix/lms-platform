"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Search, BookOpen, HelpCircle } from "lucide-react";
import { helpManuals, type SearchableEntry } from "@/content/help";

interface Result {
  entry: SearchableEntry;
  score: number;
}

const ROLE_LABELS: Record<string, string> = {
  learner: "Learner",
  manager: "Manager",
  instructor: "Instructor",
  admin: "Admin",
  "super-admin": "Super Admin",
};

function scoreEntry(entry: SearchableEntry, query: string): number {
  const q = query.toLowerCase();
  const title = entry.title.toLowerCase();
  const body = entry.body.toLowerCase();
  let score = 0;
  if (title === q) score += 100;
  if (title.startsWith(q)) score += 40;
  if (title.includes(q)) score += 20;
  // Token-level
  const tokens = q.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (title.includes(t)) score += 5;
    const bodyMatches = body.split(t).length - 1;
    score += Math.min(bodyMatches, 5);
  }
  return score;
}

function buildIndex(): SearchableEntry[] {
  const out: SearchableEntry[] = [];
  for (const manual of helpManuals) {
    for (const group of manual.groups) {
      for (const chapter of group.chapters) {
        // One entry per chapter (title + summary + body concatenation)
        out.push({
          kind: "chapter",
          role: manual.role,
          chapterSlug: chapter.slug,
          title: chapter.title,
          subtitle: `${manual.title} · ${group.heading}`,
          body: `${chapter.summary} ${chapter.sections.map((s) => s.heading + " " + s.body).join(" ")}`,
        });
        // One entry per FAQ
        for (const faq of chapter.faqs) {
          out.push({
            kind: "faq",
            role: manual.role,
            chapterSlug: chapter.slug,
            title: faq.q,
            subtitle: `${chapter.title} · FAQ`,
            body: faq.a,
          });
        }
      }
    }
  }
  return out;
}

let INDEX_CACHE: SearchableEntry[] | null = null;
function getIndex(): SearchableEntry[] {
  if (!INDEX_CACHE) INDEX_CACHE = buildIndex();
  return INDEX_CACHE;
}

export function HelpSearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo<Result[]>(() => {
    if (!query.trim()) return [];
    const idx = getIndex();
    const scored = idx
      .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
      .filter((r) => r.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 30);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-search-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / input */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            id="help-search-title"
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help manuals and FAQs…"
            className="flex-1 bg-transparent text-base focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help search"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {query.trim() === "" ? (
            <div className="p-6">
              <p className="text-sm text-gray-500">
                Start typing to search across all role manuals and FAQs.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {helpManuals.map((m) => (
                  <Link
                    key={m.role}
                    href={`/help/${m.role}`}
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-primary-300 hover:bg-primary-50"
                  >
                    <BookOpen className="h-4 w-4 text-primary-600" />
                    {ROLE_LABELS[m.role]}
                  </Link>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No results for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((r, i) => {
                const href = `/help/${r.entry.role}/${r.entry.chapterSlug}`;
                return (
                  <li key={i}>
                    <Link
                      href={href}
                      onClick={onClose}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50"
                    >
                      <span className="mt-0.5">
                        {r.entry.kind === "faq" ? (
                          <HelpCircle className="h-4 w-4 text-primary-500" />
                        ) : (
                          <BookOpen className="h-4 w-4 text-primary-500" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">{r.entry.title}</div>
                        <div className="mt-0.5 text-xs text-gray-500">{r.entry.subtitle}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default HelpSearchDialog;
