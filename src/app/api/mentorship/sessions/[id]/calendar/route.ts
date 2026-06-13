import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { generateICSFile } from "@/lib/integrations/video-conferencing";

/**
 * GET /api/mentorship/sessions/[id]/calendar
 * Returns an .ics calendar file for a mentoring session. Accessible only to
 * the session's mentor or mentee (or an admin).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { data: session, error } = await service
    .from("mentorship_sessions")
    .select(
      "id, scheduled_at, duration_minutes, meeting_url, notes, request:mentorship_requests!mentorship_sessions_request_id_fkey(mentee_id, mentor_id, mentee:users!mentorship_requests_mentee_id_fkey(first_name, last_name), mentor:users!mentorship_requests_mentor_id_fkey(first_name, last_name))"
    )
    .eq("id", id)
    .single();

  if (error || !session || !session.scheduled_at) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const req = session.request as any;
  const isParticipant =
    req?.mentee_id === auth.user.id || req?.mentor_id === auth.user.id;
  if (!isParticipant && auth.user.role !== "admin" && auth.user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const start = new Date(session.scheduled_at);
  const end = new Date(start.getTime() + (session.duration_minutes || 30) * 60000);
  const name = (u: any) =>
    u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : "";
  const mentorName = name(Array.isArray(req?.mentor) ? req.mentor[0] : req?.mentor);
  const menteeName = name(Array.isArray(req?.mentee) ? req.mentee[0] : req?.mentee);
  const withWho = [mentorName, menteeName].filter(Boolean).join(" & ");

  // scheduled_at is an absolute instant; emit it in UTC so calendars localize it.
  const icsContent = generateICSFile({
    title: withWho ? `Mentoring Session: ${withWho}` : "Mentoring Session",
    description: session.notes,
    session_date: start.toISOString().slice(0, 10),
    start_time: start.toISOString().slice(11, 16),
    end_time: end.toISOString().slice(11, 16),
    timezone: "UTC",
    meeting_url: session.meeting_url,
  });

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="mentoring-session.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
