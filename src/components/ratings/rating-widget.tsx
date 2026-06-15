"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";

interface Summary {
  course_avg: number | null;
  course_count: number;
  instructor_avg: number | null;
  instructor_count: number;
  my_rating: { course_rating: number | null; instructor_rating: number | null } | null;
}

function Stars({ value, onChange, readOnly = false }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(0)}
            className={readOnly ? "cursor-default" : "cursor-pointer"}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star className={`h-5 w-5 ${filled ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
          </button>
        );
      })}
    </div>
  );
}

export default function RatingWidget({
  courseId,
  classId,
  sessionId,
  instructorId,
  instructorName,
}: {
  courseId: string;
  classId?: string;
  sessionId?: string;
  instructorId?: string | null;
  instructorName?: string | null;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [courseStars, setCourseStars] = useState(0);
  const [instrStars, setInstrStars] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (classId) params.set("class_id", classId);
    params.set("course_id", courseId);
    const res = await fetch(`/api/ratings?${params.toString()}`);
    if (res.ok) {
      const s: Summary = await res.json();
      setSummary(s);
      if (s.my_rating) {
        setCourseStars(s.my_rating.course_rating ?? 0);
        setInstrStars(s.my_rating.instructor_rating ?? 0);
      }
    }
  }, [courseId, classId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!courseStars && !instrStars) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          class_id: classId ?? null,
          session_id: sessionId ?? null,
          instructor_id: instructorId ?? null,
          course_rating: courseStars || null,
          instructor_rating: instrStars || null,
          comment: comment || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        await load();
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const avgLabel = (avg: number | null, count: number) =>
    avg != null ? `${avg.toFixed(1)} · ${count} rating${count === 1 ? "" : "s"}` : "No ratings yet";

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Star className="h-4 w-4 text-amber-400" /> Rate this class
      </h2>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-gray-700">Course</p>
            <p className="text-xs text-gray-400">{avgLabel(summary?.course_avg ?? null, summary?.course_count ?? 0)}</p>
          </div>
          <Stars value={courseStars} onChange={setCourseStars} />
        </div>

        {instructorId && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <div>
              <p className="text-sm text-gray-700">Instructor{instructorName ? ` · ${instructorName}` : ""}</p>
              <p className="text-xs text-gray-400">{avgLabel(summary?.instructor_avg ?? null, summary?.instructor_count ?? 0)}</p>
            </div>
            <Stars value={instrStars} onChange={setInstrStars} />
          </div>
        )}

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Add a comment (optional)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={saving || (!courseStars && !instrStars)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            {summary?.my_rating ? "Update rating" : "Submit rating"}
          </button>
          {saved && <span className="inline-flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        </div>
      </div>
    </section>
  );
}
