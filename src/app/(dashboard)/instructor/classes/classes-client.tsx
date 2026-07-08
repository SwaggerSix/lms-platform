"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GraduationCap,
  Users,
  CalendarDays,
  Search,
  BookOpen,
} from "lucide-react";

export interface InstructorClass {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  thumbnailUrl: string | null;
  courseType: string;
  status: string;
  difficulty: string;
  participantCount: number;
  sessionCount: number;
  nextSessionDate: string | null;
}

const GRADIENTS = [
  "from-blue-500 to-primary-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
];

const COURSE_TYPE_LABELS: Record<string, string> = {
  self_paced: "Self-Paced",
  instructor_led: "Instructor-Led",
  blended: "Blended",
  scorm: "SCORM",
  external: "External",
};

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClassesClient({
  classes,
}: {
  classes: InstructorClass[];
}) {
  const [query, setQuery] = useState("");

  const filtered = classes.filter((c) =>
    `${c.title} ${c.shortDescription}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <GraduationCap className="h-6 w-6 text-primary-600" />
            My Classes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            The courses and classes you teach. Select one to manage its
            schedule, participants, materials, and evaluations.
          </p>
        </div>
        {classes.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search classes..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <BookOpen className="h-10 w-10 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            No classes assigned yet
          </h2>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            When an administrator assigns you to a course or schedules you to
            lead a session, your classes will appear here as tiles.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const nextDate = formatDate(c.nextSessionDate);
            return (
              <Link
                key={c.id}
                href={`/instructor/classes/${c.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div
                  className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${gradientFor(
                    c.id
                  )}`}
                >
                  {c.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <GraduationCap className="h-10 w-10 text-white/90" />
                  )}
                  {c.status !== "published" && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {c.status}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <span className="mb-1 text-xs font-medium text-primary-600">
                    {COURSE_TYPE_LABELS[c.courseType] ?? c.courseType}
                  </span>
                  <h3 className="line-clamp-2 text-base font-semibold text-gray-900 group-hover:text-primary-700">
                    {c.title}
                  </h3>
                  {c.shortDescription && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                      {c.shortDescription}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-4 pt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {c.participantCount}{" "}
                      {c.participantCount === 1 ? "participant" : "participants"}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {nextDate ? nextDate : `${c.sessionCount} sessions`}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-gray-500">
              No classes match &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
