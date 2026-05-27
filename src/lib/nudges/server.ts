import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient;

/** Next send date (YYYY-MM-DD) based on a campaign's cadence. */
export function calculateNextStartDate(frequency: string, frequencyDays: number | null): string {
  const next = new Date();
  switch (frequency) {
    case "every_other_day":
      next.setDate(next.getDate() + 2);
      break;
    case "weekdays":
      next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
      break;
    case "custom":
      next.setDate(next.getDate() + (frequencyDays ?? 1));
      break;
    case "daily":
    default:
      next.setDate(next.getDate() + 1);
  }
  return next.toISOString().split("T")[0];
}

/**
 * Replace an assignment's action with a random different active action in the
 * same category (org-scoped or global). Shared by the manager swap API and the
 * public token swap-link. Pass enforceOwner=false for the public path.
 */
export async function swapAssignmentAction(
  db: DB,
  assignmentId: string,
  userId: string | null,
  isAdmin: boolean,
  enforceOwner = true
): Promise<{ ok: true; action: unknown } | { ok: false; error: string; status: number }> {
  const { data: assignment } = await db
    .from("nudge_assignments")
    .select("id, assigned_by, organization_id, nudge_action_id, nudge_actions(category)")
    .eq("id", assignmentId)
    .single();
  if (!assignment) return { ok: false, error: "Not found", status: 404 };

  if (enforceOwner && !isAdmin && assignment.assigned_by !== userId) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  const category = (assignment.nudge_actions as unknown as { category: string } | null)?.category ?? "General";

  let query = db
    .from("nudge_actions")
    .select("id, title")
    .eq("category", category)
    .eq("is_active", true)
    .neq("id", assignment.nudge_action_id);
  if (assignment.organization_id) {
    query = query.or(`organization_id.eq.${assignment.organization_id},organization_id.is.null`);
  } else {
    query = query.is("organization_id", null);
  }
  const { data: candidates } = await query;
  if (!candidates || candidates.length === 0) {
    return { ok: false, error: "No alternative action available", status: 400 };
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const { data: updated, error } = await db
    .from("nudge_assignments")
    .update({ nudge_action_id: pick.id })
    .eq("id", assignmentId)
    .select("*, nudge_actions(title, description, estimated_minutes, image_url, quote, quote_author)")
    .single();
  if (error) return { ok: false, error: "Internal server error", status: 500 };

  await logNudgeActivity(db, assignmentId, "swapped", pick.title);
  return { ok: true, action: updated };
}

/** Append a row to the activity feed; never throws. */
export async function logNudgeActivity(
  db: DB,
  assignmentId: string,
  action: "committed" | "completed" | "skipped" | "swapped",
  actionTitle = "",
  reflection = ""
): Promise<void> {
  try {
    await db.from("nudge_activity_log").insert({
      assignment_id: assignmentId,
      action,
      action_title: actionTitle,
      reflection,
    });
  } catch {
    /* activity log is best-effort */
  }
}

/** Create/update the streak record for an assignment on commit or complete. */
export async function upsertNudgeStreak(
  db: DB,
  assignmentId: string,
  type: "committed" | "completed",
  today?: string
): Promise<void> {
  const { data: existing } = await db
    .from("nudge_streaks")
    .select("*")
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (!existing) {
    await db.from("nudge_streaks").insert({
      assignment_id: assignmentId,
      current_streak: type === "completed" ? 1 : 0,
      longest_streak: type === "completed" ? 1 : 0,
      total_committed: type === "committed" ? 1 : 0,
      total_completed: type === "completed" ? 1 : 0,
      last_completed_date: type === "completed" ? today ?? null : null,
    });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (type === "committed") {
    updates.total_committed = existing.total_committed + 1;
  } else if (type === "completed" && today) {
    updates.total_completed = existing.total_completed + 1;
    const lastDate = existing.last_completed_date;
    if (lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      if (lastDate === yesterdayStr) {
        const newStreak = existing.current_streak + 1;
        updates.current_streak = newStreak;
        updates.longest_streak = Math.max(existing.longest_streak, newStreak);
      } else {
        updates.current_streak = 1;
        updates.longest_streak = Math.max(existing.longest_streak, 1);
      }
      updates.last_completed_date = today;
    }
  }

  await db.from("nudge_streaks").update(updates).eq("assignment_id", assignmentId);
}

/**
 * Advance a campaign enrollment to its next action after the current one is
 * completed. Creates the next assignment, or marks the enrollment (and, when
 * everyone is done, the campaign) complete. Never throws.
 */
export async function advanceCampaignEnrollment(db: DB, enrollmentId: string): Promise<void> {
  try {
    const { data: enrollment } = await db
      .from("nudge_campaign_enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .single();
    if (!enrollment || enrollment.status !== "active") return;

    const { data: campaign } = await db
      .from("nudge_campaigns")
      .select("*")
      .eq("id", enrollment.campaign_id)
      .single();
    if (!campaign) return;

    if (enrollment.current_assignment_id) {
      await db
        .from("nudge_assignments")
        .update({ status: "completed" })
        .eq("id", enrollment.current_assignment_id);
    }

    const nextPosition = enrollment.current_position + 1;

    if (nextPosition > campaign.total_nudges) {
      await db
        .from("nudge_campaign_enrollments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", enrollmentId);

      const { data: remaining } = await db
        .from("nudge_campaign_enrollments")
        .select("id")
        .eq("campaign_id", campaign.id)
        .neq("status", "completed");
      if (!remaining || remaining.length === 0) {
        await db.from("nudge_campaigns").update({ status: "completed" }).eq("id", campaign.id);
      }
      return;
    }

    const { data: nextItem } = await db
      .from("nudge_campaign_items")
      .select("nudge_action_id")
      .eq("campaign_id", campaign.id)
      .eq("position", nextPosition)
      .single();
    if (!nextItem) return;

    const nextStart = calculateNextStartDate(campaign.frequency, campaign.frequency_days);

    const { data: nextAssignment } = await db
      .from("nudge_assignments")
      .insert({
        organization_id: campaign.organization_id,
        nudge_action_id: nextItem.nudge_action_id,
        assignee_id: enrollment.assignee_id,
        assigned_by: campaign.created_by,
        assignee_name: enrollment.assignee_name,
        assignee_email: enrollment.assignee_email,
        assignee_phone: enrollment.assignee_phone,
        status: "active",
        send_morning_email: campaign.send_morning_email,
        send_morning_sms: campaign.send_morning_sms,
        send_evening_email: campaign.send_evening_email,
        send_evening_sms: campaign.send_evening_sms,
        morning_send_time: campaign.morning_send_time,
        evening_send_time: campaign.evening_send_time,
        timezone: campaign.timezone,
        starts_on: nextStart,
        campaign_id: campaign.id,
        campaign_enrollment_id: enrollmentId,
        campaign_position: nextPosition,
      })
      .select("id")
      .single();

    await db
      .from("nudge_campaign_enrollments")
      .update({ current_position: nextPosition, current_assignment_id: nextAssignment?.id ?? null })
      .eq("id", enrollmentId);
  } catch (err) {
    console.error("Campaign advancement error:", err);
  }
}
