import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyMentorshipNudge } from "@/lib/mentorship/notify";

// Daily cron: for each active mentorship that has gone too long without a
// completed session, send a nudge to both parties (in-app + email). Honors
// a cooldown via `mentorship_requests.last_nudge_sent_at` so a quiet pair
// doesn't get pinged every day.

const INACTIVITY_DAYS = 21; // nudge after this many days of no contact
const COOLDOWN_DAYS = 14;   // don't re-nudge a pair within this window

export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const now = Date.now();
  const inactivityCutoff = new Date(now - INACTIVITY_DAYS * 86_400_000).toISOString();
  const cooldownCutoff = new Date(now - COOLDOWN_DAYS * 86_400_000).toISOString();

  // Candidate pairs: active mentorships, paired before the inactivity window,
  // not nudged within the cooldown.
  const { data: candidates, error } = await service
    .from("mentorship_requests")
    .select("id, mentee_id, mentor_id, matched_at, last_nudge_sent_at")
    .eq("status", "active")
    .not("mentor_id", "is", null)
    .lte("matched_at", inactivityCutoff)
    .or(`last_nudge_sent_at.is.null,last_nudge_sent_at.lte.${cooldownCutoff}`);

  if (error) {
    console.error("mentorship-nudges: query error", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  let nudgedCount = 0;
  const errors: string[] = [];

  for (const c of candidates ?? []) {
    try {
      // The "last activity" is the latest completed session, or the pair's
      // matched_at if there are none yet.
      const { data: lastSession } = await service
        .from("mentorship_sessions")
        .select("scheduled_at, status")
        .eq("request_id", c.id)
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastActivity = lastSession?.scheduled_at
        ? new Date(lastSession.scheduled_at)
        : c.matched_at
        ? new Date(c.matched_at)
        : null;
      if (!lastActivity) continue;

      const daysSinceContact = Math.floor((now - lastActivity.getTime()) / 86_400_000);
      if (daysSinceContact < INACTIVITY_DAYS) continue;

      // Skip if a session is already on the books in the future — they don't
      // need a nudge, they need to keep that appointment.
      const { data: upcoming } = await service
        .from("mentorship_sessions")
        .select("id")
        .eq("request_id", c.id)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(now).toISOString())
        .limit(1)
        .maybeSingle();
      if (upcoming) continue;

      await notifyMentorshipNudge({
        menteeId: c.mentee_id,
        mentorId: c.mentor_id,
        daysSinceContact,
      });

      await service
        .from("mentorship_requests")
        .update({ last_nudge_sent_at: new Date(now).toISOString() })
        .eq("id", c.id);

      nudgedCount++;
    } catch (err: any) {
      errors.push(`${c.id}: ${err?.message ?? String(err)}`);
    }
  }

  return NextResponse.json({
    status: "ok",
    candidates: candidates?.length ?? 0,
    nudged: nudgedCount,
    errors,
  });
}
