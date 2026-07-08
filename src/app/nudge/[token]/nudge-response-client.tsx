"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface NudgeData {
  assigneeName: string;
  status: string;
  actionTitle: string;
  actionDescription: string;
  estimatedMinutes: number;
  imageUrl: string;
  quote: string;
  quoteAuthor: string;
  todayLog: { committed: boolean | null; completed: boolean | null; reflection: string } | null;
  streak: { currentStreak: number; longestStreak: number; totalCompleted: number } | null;
}

export default function NudgeResponseClient({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<NudgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"committed" | "completed" | "skipped" | null>(null);
  const autoRan = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/nudge-respond/${token}`);
      if (!res.ok) throw new Error("This nudge could not be found.");
      const json = (await res.json()) as NudgeData;
      setData(json);
      if (json.todayLog?.reflection) setReflection(json.todayLog.reflection);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const submit = useCallback(
    async (action: "commit" | "complete" | "skip") => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/nudge-respond/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reflection: reflection || undefined }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Could not record your response.");
        }
        setResult(action === "commit" ? "committed" : action === "complete" ? "completed" : "skipped");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setSubmitting(false);
      }
    },
    [token, reflection, load]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Auto-perform the action passed in the email link (?action=commit|complete|skip).
  useEffect(() => {
    if (autoRan.current || loading || !data || data.status !== "active") return;
    const a = searchParams.get("action");
    if (a === "commit" || a === "complete" || a === "skip") {
      autoRan.current = true;
      submit(a);
    }
  }, [loading, data, searchParams, submit]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow">
        <div className="bg-indigo-600 px-6 py-5 text-center">
          <span className="text-xl font-bold text-white">Your Daily Nudge</span>
        </div>
        <div className="space-y-4 p-6">
          {loading && <p className="text-center text-gray-500">Loading…</p>}

          {!loading && error && !data && <p className="text-center text-red-600">{error}</p>}

          {data && (
            <>
              <p className="text-sm text-gray-500">Hi {data.assigneeName.split(" ")[0]},</p>
              {data.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.imageUrl} alt="" className="w-full rounded-lg" />
              )}
              <div className="rounded-lg border-l-4 border-indigo-600 bg-indigo-50/50 p-4">
                <h1 className="text-lg font-semibold text-gray-900">{data.actionTitle}</h1>
                {data.quote && (
                  <p className="mt-2 text-sm italic text-gray-500">&ldquo;{data.quote}&rdquo;{data.quoteAuthor ? ` — ${data.quoteAuthor}` : ""}</p>
                )}
                {data.actionDescription && <p className="mt-2 text-sm text-gray-700">{data.actionDescription}</p>}
                <p className="mt-2 text-xs font-semibold text-indigo-600">~{data.estimatedMinutes} minutes</p>
              </div>

              {data.streak && data.streak.currentStreak > 0 && (
                <p className="text-center text-sm text-orange-600">🔥 {data.streak.currentStreak}-day streak — keep it going!</p>
              )}

              {data.status !== "active" ? (
                <p className="text-center text-gray-500">This nudge is no longer active.</p>
              ) : result === "completed" || data.todayLog?.completed ? (
                <p className="text-center font-medium text-green-600">✅ Marked complete. Great work today!</p>
              ) : result === "skipped" ? (
                <p className="text-center text-gray-500">No worries — tomorrow is a new opportunity.</p>
              ) : (
                <div className="space-y-3">
                  <textarea
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                    rows={2}
                    placeholder="Optional reflection…"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                  />
                  <div className="flex flex-col gap-2">
                    {!data.todayLog?.committed && result !== "committed" && (
                      <Button size="lg" disabled={submitting} onClick={() => submit("commit")}>
                        I Commit to This Today!
                      </Button>
                    )}
                    {(data.todayLog?.committed || result === "committed") && (
                      <p className="text-center text-sm text-indigo-600">Committed — check back this evening to complete it.</p>
                    )}
                    <Button variant="success" size="lg" disabled={submitting} onClick={() => submit("complete")}>
                      Yes, I Did It!
                    </Button>
                    <Button variant="secondary" size="lg" disabled={submitting} onClick={() => submit("skip")}>
                      Not Today
                    </Button>
                  </div>
                  {error && <p className="text-center text-sm text-red-600">{error}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
