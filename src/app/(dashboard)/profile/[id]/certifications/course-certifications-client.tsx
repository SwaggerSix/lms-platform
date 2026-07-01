"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, Loader2, Search, CheckCircle2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface CourseItem {
  id: string;
  title: string;
  shortDescription: string | null;
  category: string | null;
}

export default function CourseCertificationsClient({
  subjectId,
  subjectName,
  courses,
  initialCertifications,
}: {
  subjectId: string;
  subjectName: string;
  /** All published gC / GGS courses. */
  courses: CourseItem[];
  /** course_id -> certified_date (or null when certified with no date yet). */
  initialCertifications: Record<string, string | null>;
}) {
  // Which courses are certified, and the recorded date for each.
  const [certified, setCertified] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const id of Object.keys(initialCertifications)) m[id] = true;
    return m;
  });
  const [dates, setDates] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const [id, d] of Object.entries(initialCertifications)) m[id] = d ?? "";
    return m;
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const setBusy = (courseId: string, busy: boolean) =>
    setSaving((s) => ({ ...s, [courseId]: busy }));

  // Create/update the certification (used when checking the box or changing the date).
  const persist = async (courseId: string, date: string) => {
    setBusy(courseId, true);
    setError(null);
    try {
      const res = await fetch("/api/subcontractor-certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: subjectId,
          course_id: courseId,
          certified_date: date || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save certification");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      // Roll the checkbox back so UI reflects reality.
      setCertified((c) => ({ ...c, [courseId]: false }));
    } finally {
      setBusy(courseId, false);
    }
  };

  const removeCert = async (courseId: string) => {
    setBusy(courseId, true);
    setError(null);
    try {
      const res = await fetch(
        `/api/subcontractor-certifications?user_id=${encodeURIComponent(
          subjectId
        )}&course_id=${encodeURIComponent(courseId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove certification");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setCertified((c) => ({ ...c, [courseId]: true }));
    } finally {
      setBusy(courseId, false);
    }
  };

  const handleToggle = (courseId: string) => {
    const next = !certified[courseId];
    setCertified((c) => ({ ...c, [courseId]: next }));
    if (next) {
      // Newly certified — create the row (date can be added next).
      persist(courseId, dates[courseId] ?? "");
    } else {
      removeCert(courseId);
    }
  };

  const handleDateChange = (courseId: string, value: string) => {
    setDates((d) => ({ ...d, [courseId]: value }));
    if (certified[courseId]) persist(courseId, value);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q)
    );
  }, [courses, search]);

  const certifiedCount = Object.values(certified).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/profile/${subjectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </Link>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Gotham Course Certifications
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {subjectName} &middot;{" "}
              <span className="font-medium text-gray-700">
                {certifiedCount}
              </span>{" "}
              of {courses.length} gC &amp; GGS courses certified
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              <Award className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              No courses match your search.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((course) => {
                const isCertified = !!certified[course.id];
                const busy = !!saving[course.id];
                return (
                  <li
                    key={course.id}
                    className={cn(
                      "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                      isCertified && "bg-green-50/40"
                    )}
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isCertified}
                        disabled={busy}
                        onChange={() => handleToggle(course.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                          {course.title}
                          {isCertified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          )}
                        </span>
                        {course.category && (
                          <span className="mt-0.5 block text-xs text-gray-400">
                            {course.category}
                          </span>
                        )}
                      </span>
                    </label>

                    <div className="flex items-center gap-2 pl-7 sm:pl-0">
                      {busy && (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      )}
                      <label className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="whitespace-nowrap">Certified on</span>
                        <input
                          type="date"
                          value={dates[course.id] ?? ""}
                          disabled={!isCertified || busy}
                          onChange={(e) =>
                            handleDateChange(course.id, e.target.value)
                          }
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </label>
                    </div>
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
