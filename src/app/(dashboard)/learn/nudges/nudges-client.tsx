"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Flame, CheckCircle2, Clock, Zap, Target } from "lucide-react";
import type { NudgeAssignment, NudgeDailyLog, NudgeStreak } from "@/types/nudges";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getHelp } from "@/lib/help-content";

type Nudge = NudgeAssignment & {
  todayLog: NudgeDailyLog | null;
  streak: NudgeStreak | null;
};

interface Props {
  nudges: Nudge[];
}

export default function NudgesLearnerClient({ nudges: initial }: Props) {
  const [nudges, setNudges] = useState<Nudge[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const toast = useToast();

  const active = nudges.filter((n) => n.status === "active");
  const done = nudges.filter((n) => n.status !== "active");

  async function respond(nudge: Nudge, action: "commit" | "complete" | "skip") {
    setBusyId(nudge.id);
    try {
      const res = await fetch(`/api/nudge-respond/${nudge.response_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reflection: reflections[nudge.id] || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong");
      }
      const now = new Date().toISOString();
      setNudges((prev) =>
        prev.map((n) => {
          if (n.id !== nudge.id) return n;
          const log: NudgeDailyLog = {
            ...(n.todayLog ?? ({} as NudgeDailyLog)),
            committed: action === "commit" ? true : n.todayLog?.committed ?? null,
            committed_at: action === "commit" ? now : n.todayLog?.committed_at ?? null,
            completed: action === "complete" ? true : action === "skip" ? false : n.todayLog?.completed ?? null,
            completed_at: action === "complete" ? now : n.todayLog?.completed_at ?? null,
            reflection: reflections[n.id] || n.todayLog?.reflection || "",
          } as NudgeDailyLog;
          return { ...n, todayLog: log };
        })
      );
      toast.success(
        action === "commit" ? "Commitment logged. You've got this!" : action === "complete" ? "Nice work — keep the streak alive!" : "Marked as not done today."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update nudge");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">My Nudges</h1>
            <InfoTooltip content={getHelp("learn.nudges").details} label="About Nudges" side="bottom" />
          </div>
          <p className="text-sm text-gray-500">Small daily MicroActions that build lasting habits.</p>
        </div>
      </div>

      {active.length === 0 && done.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Target className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            You have no nudges yet. Your manager can assign you daily MicroActions.
          </CardContent>
        </Card>
      )}

      {active.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Today</h2>
          {active.map((n) => {
            const committed = !!n.todayLog?.committed;
            const completed = !!n.todayLog?.completed;
            const busy = busyId === n.id;
            return (
              <Card key={n.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{n.nudge_actions?.title}</h3>
                      {n.nudge_actions?.description && (
                        <p className="mt-1 text-sm text-gray-600">{n.nudge_actions.description}</p>
                      )}
                      {n.nudge_actions?.quote && (
                        <p className="mt-2 text-sm italic text-gray-500">&ldquo;{n.nudge_actions.quote}&rdquo;{n.nudge_actions.quote_author ? ` — ${n.nudge_actions.quote_author}` : ""}</p>
                      )}
                    </div>
                    {n.streak && n.streak.current_streak > 0 && (
                      <Badge className="shrink-0 bg-orange-100 text-orange-700">
                        <Flame className="mr-1 inline h-3.5 w-3.5" />
                        {n.streak.current_streak} day streak
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />~{n.nudge_actions?.estimated_minutes ?? 2} min</span>
                    {committed && <Badge variant="outline">Committed today</Badge>}
                    {completed && <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Completed today</Badge>}
                  </div>

                  {!completed && (
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Optional: jot a quick reflection..."
                        value={reflections[n.id] ?? ""}
                        onChange={(e) => setReflections((r) => ({ ...r, [n.id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-2">
                        {!committed && (
                          <Button onClick={() => respond(n, "commit")} loading={busy} disabled={busy}>
                            I Commit to This Today
                          </Button>
                        )}
                        <Button variant="default" onClick={() => respond(n, "complete")} loading={busy} disabled={busy}>
                          Yes, I Did It!
                        </Button>
                        <Button variant="ghost" onClick={() => respond(n, "skip")} disabled={busy}>
                          Not Today
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Past Nudges</h2>
          {done.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900">{n.nudge_actions?.title}</p>
                  {n.streak && (
                    <p className="text-xs text-gray-500">{n.streak.total_completed} completions · longest streak {n.streak.longest_streak}</p>
                  )}
                </div>
                <Badge variant="outline" className="capitalize">{n.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
