import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import {
  createMeeting,
  updateMeeting,
  deleteMeeting,
  type MeetingProvider,
} from "@/lib/integrations/video-conferencing";
import type { ILTSessionStatus } from "@/types/database";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

/**
 * GET /api/ilt-sessions
 * Query params: status, course_id, date_from, date_to
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  const tenantScope = profile ? await getTenantScope(profile.id, profile.role, request) : null;

  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") as ILTSessionStatus | null;
  const courseId = searchParams.get("course_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  let query = service
    .from("ilt_sessions")
    .select("*, ilt_attendance(*)")
    .order("session_date", { ascending: true });

  if (tenantScope) {
    query = query.in("course_id", tenantScope.courseIds);
  }

  if (status) {
    query = query.eq("status", status);
  }
  if (courseId) {
    query = query.eq("course_id", courseId);
  }
  if (dateFrom) {
    query = query.gte("session_date", dateFrom);
  }
  if (dateTo) {
    query = query.lte("session_date", dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error("ILT sessions GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Map to expected shape with registered_count and attendees
  const sessions = (data ?? []).map((s) => ({
    id: s.id,
    course_id: s.course_id,
    title: s.title,
    description: s.description,
    instructor_id: s.instructor_id,
    session_date: s.session_date,
    start_time: s.start_time,
    end_time: s.end_time,
    timezone: s.timezone,
    location_type: s.location_type,
    location_details: s.location_details,
    meeting_url: s.meeting_url,
    meeting_provider: s.meeting_provider || null,
    meeting_id: s.meeting_id || null,
    meeting_password: s.meeting_password || null,
    meeting_settings: s.meeting_settings || {},
    max_capacity: s.max_capacity,
    min_capacity: s.min_capacity,
    status: s.status,
    registered_count: s.ilt_attendance?.length ?? 0,
    attendees: (s.ilt_attendance ?? []).map((a: Record<string, unknown>) => ({
      id: a.id,
      user_id: a.user_id,
      attendance_status: a.attendance_status,
      check_in_time: a.check_in_time,
      notes: a.notes,
    })),
  }));

  return NextResponse.json({
    sessions,
    total: sessions.length,
  });
}

/**
 * POST /api/ilt-sessions
 * Create a new ILT session
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();

  // Build insert data
  const insertData: Record<string, unknown> = {
    course_id: body.course_id,
    title: body.title,
    description: body.description || "",
    instructor_id: body.instructor_id || null,
    session_date: body.session_date,
    start_time: body.start_time,
    end_time: body.end_time,
    timezone: body.timezone || "America/New_York",
    location_type: body.location_type || "virtual",
    location_details: body.location_details || "",
    meeting_url: body.meeting_url || null,
    max_capacity: body.max_capacity || 30,
    min_capacity: body.min_capacity || 5,
    status: "scheduled",
    meeting_provider: body.meeting_provider || null,
    meeting_id: null,
    meeting_password: null,
    meeting_settings: body.meeting_settings || {},
  };

  // If a meeting provider is specified, try to auto-create the meeting
  if (body.meeting_provider && body.meeting_provider !== "custom") {
    if (body.auto_create_meeting !== false) {
      try {
        const meetingResult = await createMeeting(body.meeting_provider as MeetingProvider, {
          title: body.title,
          description: body.description || "",
          session_date: body.session_date,
          start_time: body.start_time,
          end_time: body.end_time,
          timezone: body.timezone || "America/New_York",
        });

        insertData.meeting_url = meetingResult.meeting_url;
        insertData.meeting_id = meetingResult.meeting_id;
        insertData.meeting_password = meetingResult.meeting_password;
      } catch (err: any) {
        // If meeting creation fails, still create the session but without the meeting
        // Return the error in the response so the admin knows
        console.error("Meeting creation failed:", err.message);
        insertData._meeting_error = err.message;
      }
    }
  } else if (body.meeting_provider === "custom" && body.meeting_url) {
    insertData.meeting_url = body.meeting_url;
    insertData.meeting_id = `custom-${Date.now()}`;
  }

  // Remove non-DB fields before insert
  const meetingError = insertData._meeting_error as string | undefined;
  delete insertData._meeting_error;

  const { data, error } = await service
    .from("ilt_sessions")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("ILT sessions POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const response: Record<string, unknown> = { ...data };
  if (meetingError) {
    response.meeting_warning = meetingError;
  }

  return NextResponse.json(response, { status: 201 });
}

/**
 * PATCH /api/ilt-sessions
 * Update session or mark attendance
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const body = await request.json();
  const { session_id, action } = body;

  if (!session_id) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  // Register a learner for a session (any authenticated user)
  if (action === "register") {
    // Verify user is authenticated
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // IDOR fix: always use authenticated user's profile, never from body
    const { data: profile } = await service
      .from("users")
      .select("id")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const user_id = profile.id;

    // Check session capacity
    const { data: session } = await service
      .from("ilt_sessions")
      .select("max_capacity, status")
      .eq("id", session_id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.status === "cancelled") {
      return NextResponse.json({ error: "Session is cancelled" }, { status: 400 });
    }

    const { count: registeredCount } = await service
      .from("ilt_attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session_id)
      .eq("registration_status", "registered");

    const isFull = (registeredCount ?? 0) >= session.max_capacity;

    // Check if already registered
    const { data: existing } = await service
      .from("ilt_attendance")
      .select("id, registration_status")
      .eq("session_id", session_id)
      .eq("user_id", user_id)
      .single();

    if (existing?.registration_status === "registered") {
      return NextResponse.json({ error: "Already registered" }, { status: 409 });
    }

    if (existing) {
      // Update existing record back to registered
      const { error: updateError } = await service
        .from("ilt_attendance")
        .update({
          registration_status: isFull ? "waitlisted" : "registered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("ILT attendance update error:", updateError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    } else {
      // Create new attendance record
      const { error: insertError } = await service
        .from("ilt_attendance")
        .insert({
          session_id,
          user_id,
          registration_status: isFull ? "waitlisted" : "registered",
        });

      if (insertError) {
        console.error("ILT attendance insert error:", insertError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      status: isFull ? "waitlisted" : "registered",
    });
  }

  // All actions below require admin or instructor role
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Mark attendance for a single attendee
  if (action === "mark_attendance") {
    const { attendee_id, attendance_status, notes } = body;
    if (!attendee_id || !attendance_status) {
      return NextResponse.json(
        { error: "attendee_id and attendance_status are required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      attendance_status,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    if (attendance_status === "present" || attendance_status === "late") {
      updateData.check_in_time = new Date().toISOString();
    }

    const { error: attendError } = await service
      .from("ilt_attendance")
      .update(updateData)
      .eq("id", attendee_id);

    if (attendError) {
      console.error("ILT mark attendance error:", attendError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Return updated session with attendance
    const { data: session } = await service
      .from("ilt_sessions")
      .select("*, ilt_attendance(*)")
      .eq("id", session_id)
      .single();

    return NextResponse.json(session);
  }

  // Update session details
  if (action === "update") {
    const allowedFields = [
      "title", "description", "session_date", "start_time", "end_time",
      "timezone", "location_type", "location_details", "meeting_url",
      "max_capacity", "instructor_id", "status",
      "meeting_provider", "meeting_id", "meeting_password", "meeting_settings",
      "recording_url",
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // If session time/details changed and there's an existing meeting, update it
    const timeFieldsChanged = ["session_date", "start_time", "end_time", "title", "description", "timezone"]
      .some((f) => body[f] !== undefined);

    if (timeFieldsChanged) {
      // Fetch current session to get meeting info
      const { data: currentSession } = await service
        .from("ilt_sessions")
        .select("meeting_provider, meeting_id, title, description, session_date, start_time, end_time, timezone")
        .eq("id", session_id)
        .single();

      if (currentSession?.meeting_provider && currentSession?.meeting_id && currentSession.meeting_provider !== "custom") {
        try {
          await updateMeeting(
            currentSession.meeting_provider as MeetingProvider,
            currentSession.meeting_id,
            {
              title: body.title || currentSession.title,
              description: body.description !== undefined ? body.description : currentSession.description,
              session_date: body.session_date || currentSession.session_date,
              start_time: body.start_time || currentSession.start_time,
              end_time: body.end_time || currentSession.end_time,
              timezone: body.timezone || currentSession.timezone,
            }
          );
        } catch (err: any) {
          console.error("Failed to update meeting:", err.message);
          // Continue with session update even if meeting update fails
        }
      }
    }

    const { data, error } = await service
      .from("ilt_sessions")
      .update(updates)
      .eq("id", session_id)
      .select("*, ilt_attendance(*)")
      .single();

    if (error) {
      console.error("ILT session update error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/**
 * DELETE /api/ilt-sessions
 * Cancel a session (soft delete) and delete associated meeting
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  // Fetch session to get meeting info before cancelling
  const { data: session } = await service
    .from("ilt_sessions")
    .select("meeting_provider, meeting_id")
    .eq("id", sessionId)
    .single();

  // Delete the external meeting if one exists
  if (session?.meeting_provider && session?.meeting_id && session.meeting_provider !== "custom") {
    try {
      await deleteMeeting(session.meeting_provider as MeetingProvider, session.meeting_id);
    } catch (err: any) {
      console.error("Failed to delete meeting:", err.message);
      // Continue with cancellation even if meeting deletion fails
    }
  }

  const { error } = await service
    .from("ilt_sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    console.error("ILT session delete error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Session cancelled" });
}
