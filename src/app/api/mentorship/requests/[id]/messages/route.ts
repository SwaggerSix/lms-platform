import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { canAccessMentorshipRequest } from "@/lib/mentorship/access";
import { sendPushToUsers } from "@/lib/push/dispatch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: requestId } = await params;
  const access = await canAccessMentorshipRequest(requestId, auth.user.id, auth.user.role);
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("mentorship_messages")
    .select(
      "id, request_id, sender_id, body, created_at, sender:users!mentorship_messages_sender_id_fkey(first_name, last_name)"
    )
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Mentorship messages list error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: requestId } = await params;
  const access = await canAccessMentorshipRequest(requestId, auth.user.id, auth.user.role);
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only mentor/mentee may post, not the manager-viewer or an admin lurker.
  if (access.menteeId !== auth.user.id && access.mentorId !== auth.user.id) {
    return NextResponse.json({ error: "Only mentor or mentee can post" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "Message too long" }, { status: 400 });

  const service = createServiceClient();
  const { data: msg, error } = await service
    .from("mentorship_messages")
    .insert({ request_id: requestId, sender_id: auth.user.id, body: text })
    .select(
      "id, request_id, sender_id, body, created_at, sender:users!mentorship_messages_sender_id_fkey(first_name, last_name)"
    )
    .single();

  if (error || !msg) {
    console.error("Mentorship message create error:", error?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Best-effort in-app notification to the other participant.
  const otherId =
    auth.user.id === access.menteeId ? access.mentorId : access.menteeId;
  if (otherId) {
    const sender = msg.sender as any;
    const senderName = `${sender?.first_name ?? ""} ${sender?.last_name ?? ""}`.trim() || "Your mentorship partner";
    const preview = text.length > 140 ? text.slice(0, 137) + "..." : text;
    await service.from("notifications").insert({
      user_id: otherId,
      type: "mentorship",
      channel: "in_app",
      title: `New message from ${senderName}`,
      body: preview,
      link: `/learn/mentorship/${requestId}`,
      is_read: false,
    });
    await sendPushToUsers({
      userIds: [otherId],
      title: `New message from ${senderName}`,
      body: preview,
      url: `/learn/mentorship/${requestId}`,
    });
  }

  return NextResponse.json(msg, { status: 201 });
}
