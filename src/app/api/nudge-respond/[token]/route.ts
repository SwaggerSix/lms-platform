import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, nudgeRespondSchema } from "@/lib/validations";
import { upsertNudgeStreak, advanceCampaignEnrollment, logNudgeActivity } from "@/lib/nudges/server";

// Public, token-authenticated endpoint that employees reach from email links.

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const service = createServiceClient();

    const { data: assignment, error } = await service
      .from("nudge_assignments")
      .select("*, nudge_actions(title, description, estimated_minutes, image_url, quote, quote_author)")
      .eq("response_token", token)
      .single();
    if (error || !assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const today = new Date().toISOString().split("T")[0];
    const [logRes, streakRes] = await Promise.all([
      service.from("nudge_daily_logs").select("*").eq("assignment_id", assignment.id).eq("log_date", today).maybeSingle(),
      service.from("nudge_streaks").select("*").eq("assignment_id", assignment.id).maybeSingle(),
    ]);
    const log = logRes.data;
    const streak = streakRes.data;
    const action = assignment.nudge_actions;

    return NextResponse.json({
      assigneeName: assignment.assignee_name,
      status: assignment.status,
      actionTitle: action?.title ?? "",
      actionDescription: action?.description ?? "",
      estimatedMinutes: action?.estimated_minutes ?? 2,
      imageUrl: action?.image_url ?? "",
      quote: action?.quote ?? "",
      quoteAuthor: action?.quote_author ?? "",
      todayLog: log
        ? { committed: log.committed, committedAt: log.committed_at, completed: log.completed, completedAt: log.completed_at, reflection: log.reflection }
        : null,
      streak: streak
        ? { currentStreak: streak.current_streak, longestStreak: streak.longest_streak, totalCompleted: streak.total_completed }
        : null,
    });
  } catch (e) {
    console.error("Nudge respond GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const rl = await rateLimit(`nudge-respond-${token}`, 30, 60000);
    if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const service = createServiceClient();
    const { data: assignment, error } = await service
      .from("nudge_assignments")
      .select("id, status, campaign_enrollment_id, nudge_actions(title)")
      .eq("response_token", token)
      .single();
    if (error || !assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (assignment.status !== "active") {
      return NextResponse.json({ error: "This nudge is no longer active" }, { status: 400 });
    }

    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const validation = validateBody(nudgeRespondSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const { action, reflection } = validation.data;

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();
    const actionTitle = (assignment.nudge_actions as unknown as { title: string } | null)?.title ?? "";

    // Upsert today's daily log.
    const { data: existingLog } = await service
      .from("nudge_daily_logs")
      .select("id")
      .eq("assignment_id", assignment.id)
      .eq("log_date", today)
      .maybeSingle();
    let logId: string;
    if (existingLog) {
      logId = existingLog.id;
    } else {
      const { data: newLog, error: insertErr } = await service
        .from("nudge_daily_logs")
        .insert({ assignment_id: assignment.id, log_date: today })
        .select("id")
        .single();
      if (insertErr) throw new Error(insertErr.message);
      logId = newLog.id;
    }

    if (action === "commit") {
      await service.from("nudge_daily_logs").update({ committed: true, committed_at: now }).eq("id", logId);
      await upsertNudgeStreak(service, assignment.id, "committed");
      await logNudgeActivity(service, assignment.id, "committed", actionTitle, reflection ?? "");
    } else if (action === "complete") {
      await service
        .from("nudge_daily_logs")
        .update({ completed: true, completed_at: now, ...(reflection ? { reflection } : {}) })
        .eq("id", logId);
      await upsertNudgeStreak(service, assignment.id, "completed", today);
      await logNudgeActivity(service, assignment.id, "completed", actionTitle, reflection ?? "");
      if (assignment.campaign_enrollment_id) {
        await advanceCampaignEnrollment(service, assignment.campaign_enrollment_id);
      }
    } else if (action === "skip") {
      await service
        .from("nudge_daily_logs")
        .update({ completed: false, ...(reflection ? { reflection } : {}) })
        .eq("id", logId);
      await logNudgeActivity(service, assignment.id, "skipped", actionTitle, reflection ?? "");
    }

    return NextResponse.json({ success: true, action });
  } catch (e) {
    console.error("Nudge respond POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
