import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/sender";
import { sendSms } from "@/lib/sms";
import { withCronMonitoring } from "@/lib/cron/monitor";
import { buildMorningNudgeEmail, buildEveningNudgeEmail } from "@/lib/email/nudge-templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://example.com";

export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await withCronMonitoring("send-nudges", async () => {
      const service = createServiceClient();
      const today = new Date().toISOString().split("T")[0];
      const counters = { morningSent: 0, eveningSent: 0, errors: 0 };

      const { data: assignments, error } = await service
        .from("nudge_assignments")
        .select("*, nudge_actions(title, description, estimated_minutes, image_url, quote, quote_author)")
        .eq("status", "active")
        .lte("starts_on", today)
        .or(`ends_on.is.null,ends_on.gte.${today}`);
      if (error) throw new Error(error.message);

      for (const assignment of assignments ?? []) {
        try {
          const timezone = assignment.timezone ?? "America/New_York";
          let localHour = 0, localMinute = 0;
          try {
            const localDate = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
            localHour = localDate.getHours();
            localMinute = localDate.getMinutes();
          } catch {
            localHour = new Date().getUTCHours();
            localMinute = new Date().getUTCMinutes();
          }
          const currentMinutes = localHour * 60 + localMinute;

          const timePattern = /^\d{1,2}:\d{2}/;
          const morningSendTime = (assignment.morning_send_time as string) ?? "08:00";
          const eveningSendTime = (assignment.evening_send_time as string) ?? "18:00";
          const [mh, mm] = timePattern.test(morningSendTime) ? morningSendTime.split(":").map(Number) : [8, 0];
          const [eh, em] = timePattern.test(eveningSendTime) ? eveningSendTime.split(":").map(Number) : [18, 0];
          const morningMinutes = mh * 60 + mm;
          const eveningMinutes = eh * 60 + em;

          // Upsert today's log.
          const { data: existingLog } = await service
            .from("nudge_daily_logs")
            .select("id, morning_sent_at, evening_sent_at")
            .eq("assignment_id", assignment.id)
            .eq("log_date", today)
            .maybeSingle();
          let logId: string;
          let morningSentAt = existingLog?.morning_sent_at;
          let eveningSentAt = existingLog?.evening_sent_at;
          if (existingLog) {
            logId = existingLog.id;
          } else {
            const { data: newLog, error: insertErr } = await service
              .from("nudge_daily_logs")
              .insert({ assignment_id: assignment.id, log_date: today })
              .select("id")
              .single();
            if (insertErr) { counters.errors++; continue; }
            logId = newLog.id;
          }

          const token = assignment.response_token;
          const commitUrl = `${APP_URL}/nudge/${token}?action=commit`;
          const completeUrl = `${APP_URL}/nudge/${token}?action=complete`;
          const skipUrl = `${APP_URL}/nudge/${token}?action=skip`;
          const swapUrl = `${APP_URL}/api/nudge-swap-link/${token}`;

          const action = assignment.nudge_actions ?? {};
          const actionTitle = action.title ?? "Your MicroAction";
          const actionDesc = action.description ?? "";
          const estMin = action.estimated_minutes ?? 2;
          const actionImage = action.image_url || undefined;
          const actionQuote = action.quote || undefined;
          const actionQuoteAuthor = action.quote_author || undefined;

          // Morning window.
          if (!morningSentAt && currentMinutes >= morningMinutes && currentMinutes < morningMinutes + 15) {
            const channels: string[] = [];
            if (assignment.send_morning_email) {
              const html = buildMorningNudgeEmail(assignment.assignee_name, actionTitle, actionDesc, estMin, commitUrl, actionImage, actionQuote, actionQuoteAuthor, swapUrl);
              const res = await sendEmail({ to: assignment.assignee_email, subject: `Your MicroAction for Today: ${actionTitle}`, html });
              channels.push("email");
              await service.from("nudge_send_log").insert({
                assignment_id: assignment.id, daily_log_id: logId, nudge_type: "morning", channel: "email",
                status: res.success ? "sent" : "failed", error_message: res.success ? "" : res.error,
              });
            }
            if (assignment.send_morning_sms && assignment.assignee_phone) {
              const result = await sendSms(assignment.assignee_phone, `Good morning! Your MicroAction: "${actionTitle}" (~${estMin}min). Commit here: ${commitUrl}`);
              if (result.status === "sent") channels.push("sms");
              await service.from("nudge_send_log").insert({
                assignment_id: assignment.id, daily_log_id: logId, nudge_type: "morning", channel: "sms",
                status: result.status, external_id: result.sid, error_message: result.error ?? "",
              });
            }
            if (channels.length > 0) {
              await service.from("nudge_daily_logs").update({ morning_sent_at: new Date().toISOString(), morning_channel: channels.join(",") }).eq("id", logId);
              counters.morningSent++;
            }
          }

          // Evening window.
          if (!eveningSentAt && currentMinutes >= eveningMinutes && currentMinutes < eveningMinutes + 15) {
            const channels: string[] = [];
            if (assignment.send_evening_email) {
              const html = buildEveningNudgeEmail(assignment.assignee_name, actionTitle, completeUrl, skipUrl, actionImage, actionQuote, actionQuoteAuthor, swapUrl);
              const res = await sendEmail({ to: assignment.assignee_email, subject: `Did you complete "${actionTitle}" today?`, html });
              channels.push("email");
              await service.from("nudge_send_log").insert({
                assignment_id: assignment.id, daily_log_id: logId, nudge_type: "evening", channel: "email",
                status: res.success ? "sent" : "failed", error_message: res.success ? "" : res.error,
              });
            }
            if (assignment.send_evening_sms && assignment.assignee_phone) {
              const result = await sendSms(assignment.assignee_phone, `Evening check-in: Did you complete "${actionTitle}" today? Reply here: ${completeUrl}`);
              if (result.status === "sent") channels.push("sms");
              await service.from("nudge_send_log").insert({
                assignment_id: assignment.id, daily_log_id: logId, nudge_type: "evening", channel: "sms",
                status: result.status, external_id: result.sid, error_message: result.error ?? "",
              });
            }
            if (channels.length > 0) {
              await service.from("nudge_daily_logs").update({ evening_sent_at: new Date().toISOString(), evening_channel: channels.join(",") }).eq("id", logId);
              counters.eveningSent++;
            }
          }
        } catch {
          counters.errors++;
        }
      }

      return { ...counters, records_processed: (assignments ?? []).length };
    });

    return NextResponse.json({ message: "Nudges processed", results });
  } catch (err) {
    console.error("send-nudges cron error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
