import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { MessageType } from "@/types/database";
import { validateBody, sendMessageSchema } from "@/lib/validations";

/**
 * GET /api/messages
 * Query params: conversation_id (optional)
 * - With conversation_id: returns messages for that conversation
 * - Without: returns all conversations for the current user
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversation_id");

  // Look up the profile ID from the users table
  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const currentUserId = profile.id;

  // If conversation_id is provided, return messages for that conversation
  if (conversationId) {
    const { data: conversation, error: convError } = await service
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Verify current user is a participant in this conversation
    const { data: participant } = await service
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", currentUserId)
      .single();

    if (!participant) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { data: messages, error: msgError } = await service
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Messages API error:", msgError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ conversation, messages: messages ?? [] });
  }

  // Otherwise, return all conversations for the current user
  // First get conversation IDs where user is a participant
  let participantQuery = service
    .from("conversation_participants")
    .select("conversation_id");

  if (currentUserId) {
    participantQuery = participantQuery.eq("user_id", currentUserId);
  }

  const { data: participantRows } = await participantQuery;
  const conversationIds = (participantRows ?? []).map((p) => p.conversation_id);

  if (conversationIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  // Fetch conversations with participants
  const { data: conversations, error: convListError } = await service
    .from("conversations")
    .select("*, conversation_participants(*)")
    .in("id", conversationIds)
    .order("updated_at", { ascending: false });

  if (convListError) {
    console.error("Messages API error:", convListError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // For each conversation, get the last message
  const conversationsWithLastMessage = await Promise.all(
    (conversations ?? []).map(async (c) => {
      const { data: lastMessages } = await service
        .from("messages")
        .select("*")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      // Calculate unread count
      const participant = (c.conversation_participants ?? []).find(
        (p: Record<string, unknown>) => p.user_id === currentUserId
      );
      let unreadCount = 0;
      if (participant?.last_read_at) {
        const { count } = await service
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .gt("created_at", participant.last_read_at);
        unreadCount = count ?? 0;
      }

      return {
        ...c,
        participants: c.conversation_participants,
        last_message: lastMessages?.[0] || null,
        unread_count: unreadCount,
      };
    })
  );

  return NextResponse.json({ conversations: conversationsWithLastMessage });
}

/**
 * POST /api/messages
 * Send a message or create a conversation
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up profile ID from the users table
  const service = createServiceClient();
  const { data: postProfile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!postProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const currentUserId = postProfile.id;

  // Create a new conversation
  if (body.action === "create_conversation") {
    const { participant_ids, type, title } = body;

    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length === 0) {
      return NextResponse.json(
        { error: "participant_ids is required" },
        { status: 400 }
      );
    }

    // IDOR fix: always set created_by to authenticated user
    const { data: conversation, error: convError } = await service
      .from("conversations")
      .insert({
        type: type || (participant_ids.length > 2 ? "group" : "direct"),
        title: title || null,
        created_by: currentUserId,
      })
      .select()
      .single();

    if (convError) {
      console.error("Messages API error:", convError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Add participants
    const allParticipants = currentUserId
      ? [...new Set([currentUserId, ...participant_ids])]
      : participant_ids;

    const participantInserts = allParticipants.map((uid: string) => ({
      conversation_id: conversation.id,
      user_id: uid,
    }));

    await service.from("conversation_participants").insert(participantInserts);

    return NextResponse.json({ conversation }, { status: 201 });
  }

  // Send a message
  const msgValidation = validateBody(sendMessageSchema, body);
  if (!msgValidation.success) {
    return NextResponse.json({ error: msgValidation.error }, { status: 400 });
  }
  const { conversation_id, content, message_type, attachment_url, attachment_name } = body;

  // Verify conversation exists
  const { data: conv } = await service
    .from("conversations")
    .select("id")
    .eq("id", conversation_id)
    .single();

  if (!conv) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Verify sender is a participant in this conversation
  const { data: senderParticipant } = await service
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversation_id)
    .eq("user_id", currentUserId)
    .single();

  if (!senderParticipant) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const { data: message, error: msgError } = await service
    .from("messages")
    .insert({
      conversation_id,
      sender_id: currentUserId,
      content,
      message_type: (message_type as MessageType) || "text",
      attachment_url: attachment_url || null,
      attachment_name: attachment_name || null,
    })
    .select()
    .single();

  if (msgError) {
    console.error("Messages API error:", msgError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Update conversation updated_at
  await service
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation_id);

  return NextResponse.json({ message }, { status: 201 });
}

/**
 * PATCH /api/messages
 * Mark messages as read
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { conversation_id } = body;

  if (!conversation_id) {
    return NextResponse.json(
      { error: "conversation_id is required" },
      { status: 400 }
    );
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up profile ID from users table
  const service = createServiceClient();
  const { data: patchProfile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!patchProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const currentUserId = patchProfile.id;

  const now = new Date().toISOString();

  // Update last_read_at for the current user's participant record
  await service
    .from("conversation_participants")
    .update({ last_read_at: now })
    .eq("conversation_id", conversation_id)
    .eq("user_id", currentUserId);

  const { data: conversation } = await service
    .from("conversations")
    .select("*")
    .eq("id", conversation_id)
    .single();

  return NextResponse.json({
    conversation: { ...conversation, unread_count: 0 },
    marked_read_at: now,
  });
}
