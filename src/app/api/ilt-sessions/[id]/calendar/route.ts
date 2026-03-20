import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateICSFile } from "@/lib/integrations/video-conferencing";

/**
 * GET /api/ilt-sessions/[id]/calendar
 * Generate and return .ics calendar file for download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Fetch session details with instructor info
  const { data: session, error } = await service
    .from("ilt_sessions")
    .select(
      "id, title, description, session_date, start_time, end_time, timezone, location_type, location_details, meeting_url, instructor:users!ilt_sessions_instructor_id_fkey(first_name, last_name)"
    )
    .eq("id", id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const instructor = session.instructor as any;
  const instructorName = instructor
    ? `${instructor.first_name || ""} ${instructor.last_name || ""}`.trim()
    : undefined;

  const icsContent = generateICSFile({
    title: session.title,
    description: session.description,
    session_date: session.session_date,
    start_time: session.start_time?.slice(0, 5) || "00:00",
    end_time: session.end_time?.slice(0, 5) || "01:00",
    timezone: session.timezone || "America/New_York",
    location_details: session.location_details,
    meeting_url: session.meeting_url,
    instructor_name: instructorName,
  });

  const sanitizedTitle = session.title.replace(/[^a-zA-Z0-9_-]/g, "_");

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sanitizedTitle}.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
