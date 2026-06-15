"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Video, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";

interface Webinar {
  id: string;
  title: string;
  description: string | null;
  course_title: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location_type: string;
  is_free: boolean;
  max_capacity: number;
  opted_in: boolean;
}

export default function SharedWebinarsClient() {
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shared-webinars");
    if (res.ok) {
      const data = await res.json();
      setWebinars(data.webinars ?? []);
      setTenantId(data.tenant_id ?? null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (w: Webinar) => {
    setBusy(w.id);
    try {
      const res = await fetch("/api/shared-webinars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: w.id, opted_in: !w.opted_in }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shared Webinars</h1>
        <p className="mt-1 text-sm text-gray-500">
          Free webinars offered across client instances. Opt in to show them to your learners.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : tenantId === null ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          You're a platform admin (not tied to a client instance), so there's no instance to opt in. Sign in under a client instance to manage its shared webinars.
        </div>
      ) : webinars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No shared webinars are available right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webinars.map((w) => (
            <div key={w.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div>
                <p className="flex items-center gap-2 font-semibold text-gray-900">
                  {w.title}
                  {w.is_free && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Free</span>}
                </p>
                {w.course_title && <p className="text-xs text-gray-500">{w.course_title}</p>}
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(w.session_date).toLocaleDateString()} · {w.start_time}–{w.end_time} {w.timezone}</span>
                  <span className="capitalize">{w.location_type.replace("_", " ")}</span>
                </div>
              </div>
              <button
                onClick={() => toggle(w)}
                disabled={busy === w.id}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  w.opted_in ? "border border-green-300 bg-green-50 text-green-700" : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {busy === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : w.opted_in ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                {w.opted_in ? "Offered to your learners" : "Opt in"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
