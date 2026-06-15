"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Users, Loader2, GraduationCap } from "lucide-react";

interface ClassCard {
  id: string;
  title: string;
  course_title: string;
  description: string | null;
  status: string;
  thumbnail_url: string | null;
  instructor_name: string | null;
  participant_count: number;
  next_session: { session_date: string; start_time: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  draft: "bg-amber-100 text-amber-700",
};

export default function MyClassesClient() {
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/classes?mine=true");
        const data = await res.json();
        setClasses(data.classes ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everything for each class — sessions, materials, and assessments — in one place.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">You're not enrolled in any classes yet.</p>
          <p className="text-xs text-gray-400">When you're invited to a class, it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/learn/classes/${c.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700">
                {c.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <GraduationCap className="h-10 w-10 text-white/80" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {c.status.replace("_", " ")}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600">{c.title}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{c.course_title}</p>
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3 text-xs text-gray-500">
                  {c.next_session && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Next: {new Date(c.next_session.session_date).toLocaleDateString()}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {c.participant_count} enrolled
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
