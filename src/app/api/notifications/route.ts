import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createNotificationSchema, directNotificationSchema } from "@/lib/validations";

// Allowed values for the notifications.type CHECK constraint.
const ALLOWED_NOTIFICATION_TYPES = [
  "enrollment",
  "reminder",
  "completion",
  "certification",
  "announcement",
  "mention",
];

export async function GET() {
  const supabase = await createClient();
  const { data: authUser } = await supabase.auth.getUser();

  if (!authUser.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authUser.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch notifications:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const unreadCount = data?.filter((n) => !n.is_read).length || 0;
  return NextResponse.json({ notifications: data, unreadCount });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Targeted path: a reminder/notification sent to a single user.
  if (body && typeof body === "object" && "user_id" in body) {
    const direct = validateBody(directNotificationSchema, body);
    if (!direct.success) {
      return NextResponse.json({ error: direct.error }, { status: 400 });
    }

    const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
    if (!isAdmin) {
      // Managers may only notify members of their own team.
      const { data: target } = await service
        .from("users")
        .select("manager_id")
        .eq("id", direct.data.user_id)
        .single();
      if (!target || target.manager_id !== auth.user.id) {
        return NextResponse.json(
          { error: "You can only notify members of your own team" },
          { status: 403 }
        );
      }
    }

    const type =
      direct.data.type && ALLOWED_NOTIFICATION_TYPES.includes(direct.data.type)
        ? direct.data.type
        : "reminder";

    const { error } = await service.from("notifications").insert({
      user_id: direct.data.user_id,
      type,
      title: direct.data.title ?? "Reminder",
      body: direct.data.message,
      link: direct.data.link ?? null,
      channel: "in_app",
      is_read: false,
    });

    if (error) {
      console.error("Notification operation failed:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json({ sent: 1 }, { status: 201 });
  }

  // Broadcast/announcement path is admin-only.
  if (!["admin", "super_admin"].includes(auth.user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const validation = validateBody(createNotificationSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { title, body: announcementBody, audience, priority, scheduled_for, status } = validation.data;

  const channel = priority === "urgent" ? "push" : priority === "high" ? "email" : "in_app";

  if (status === "draft") {
    // Save as draft — insert a single notification row flagged as draft
    const { data, error } = await service
      .from("notifications")
      .insert({
        user_id: auth.user.id,
        type: "announcement",
        title,
        body: announcementBody,
        channel,
        is_read: false,
        metadata: { audience: audience || "all", priority: priority || "Normal", status: "draft", scheduled_for: scheduled_for || null },
      })
      .select()
      .single();

    if (error) {
      console.error("Notification operation failed:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  if (scheduled_for) {
    // Scheduled announcement — store with scheduled metadata
    const { data, error } = await service
      .from("notifications")
      .insert({
        user_id: auth.user.id,
        type: "announcement",
        title,
        body: announcementBody,
        channel,
        is_read: false,
        metadata: { audience: audience || "all", priority: priority || "Normal", status: "scheduled", scheduled_for },
      })
      .select()
      .single();

    if (error) {
      console.error("Notification operation failed:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  // Send now — broadcast to target users
  const audienceType = audience || "all";

  const validAudiences = ["all", "admin", "manager", "instructor", "learner"];
  if (!validAudiences.includes(audienceType)) {
    return NextResponse.json({ error: "Invalid audience type" }, { status: 400 });
  }

  let userQuery = service.from("users").select("id");
  if (audienceType !== "all") {
    // audience can be a role or department value
    userQuery = userQuery.eq("role", audienceType);
  }

  const { data: targetUsers } = await userQuery;

  if (!targetUsers || targetUsers.length === 0) {
    return NextResponse.json({ error: "No target users found" }, { status: 400 });
  }

  const rows = targetUsers.map((u: any) => ({
    user_id: u.id,
    type: "announcement",
    title,
    body: announcementBody,
    channel,
    is_read: false,
    metadata: { audience: audienceType, priority: priority || "Normal", status: "sent" },
  }));

  const { data, error } = await service.from("notifications").insert(rows).select();

  if (error) {
    console.error("Failed to send notifications:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ sent: data?.length || 0 }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Mark all read (existing behavior)
  if (body.mark_all_read) {

    const { data: profile } = await service
      .from("users")
      .select("id")
      .eq("auth_id", authUser.user.id)
      .single();

    if (profile) {
      await service
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", profile.id)
        .eq("is_read", false);
    }

    return NextResponse.json({ success: true });
  }

  // Mark single notification as read (existing behavior)
  if (body.id && !body.title) {
    const { data: notifProfile } = await service
      .from("users")
      .select("id")
      .eq("auth_id", authUser.user.id)
      .single();

    if (!notifProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { error } = await service
      .from("notifications")
      .update({ is_read: true })
      .eq("id", body.id)
      .eq("user_id", notifProfile.id);

    if (error) {
      console.error("Notification operation failed:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Edit an announcement (admin)
  if (body.id && body.title) {
    const auth = await authorize("admin");
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const updates: Record<string, any> = {};
    if (body.title) updates.title = body.title;
    if (body.body) updates.body = body.body;
    if (body.metadata) updates.metadata = body.metadata;

    const { data, error } = await service
      .from("notifications")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Notification operation failed:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Notification id is required" }, { status: 400 });
  }

  const { error } = await service
    .from("notifications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete notification:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ message: "Notification deleted" });
}
