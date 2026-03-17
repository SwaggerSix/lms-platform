import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MessagesClient from "./messages-client";

export const metadata: Metadata = {
  title: "Messages | LMS Platform",
  description: "Send and receive direct messages with instructors and peers",
};
import type {
  MessageUser,
  MessageData,
  ConversationData,
} from "./messages-client";

/* ------------------------------------------------------------------ */
/*  Avatar color palette (deterministic by index)                      */
/* ------------------------------------------------------------------ */

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
];

function pickColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function initials(first: string, last: string): string {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}`;
}

/* ------------------------------------------------------------------ */
/*  Server Component                                                   */
/* ------------------------------------------------------------------ */

export default async function MessagesPage() {
  const supabase = await createClient();

  // Get current authenticated user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Get the current user's profile from the users table
  const { data: currentProfile } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .single();

  const currentUserId = currentProfile?.id ?? authUser.id;

  // Get conversation IDs where user is a participant
  const { data: participantRows } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUserId);

  const conversationIds = (participantRows ?? []).map(
    (p) => p.conversation_id
  );

  if (conversationIds.length === 0) {
    // No conversations yet -- render empty state
    const currentUser: MessageUser = {
      id: currentUserId,
      name: "You",
      initials: currentProfile
        ? initials(currentProfile.first_name, currentProfile.last_name)
        : "YO",
      avatarColor: "bg-indigo-500",
      online: true,
      email: currentProfile?.email ?? authUser.email ?? "",
    };

    return (
      <MessagesClient
        currentUserId={currentUserId}
        users={{ [currentUserId]: currentUser }}
        conversations={[]}
        messages={[]}
      />
    );
  }

  // Fetch conversations with their participants (including user profiles)
  const { data: rawConversations } = await supabase
    .from("conversations")
    .select("*, conversation_participants(*, user:users(*))")
    .in("id", conversationIds)
    .order("updated_at", { ascending: false });

  const conversations = rawConversations ?? [];

  // Collect all unique user IDs across all conversations
  const userMap: Record<string, MessageUser> = {};
  let colorIdx = 0;

  // Add current user first
  userMap[currentUserId] = {
    id: currentUserId,
    name: "You",
    initials: currentProfile
      ? initials(currentProfile.first_name, currentProfile.last_name)
      : "YO",
    avatarColor: "bg-indigo-500",
    online: true,
    email: currentProfile?.email ?? authUser.email ?? "",
  };

  for (const conv of conversations) {
    for (const p of conv.conversation_participants ?? []) {
      if (userMap[p.user_id]) continue;
      const u = p.user;
      if (u) {
        userMap[p.user_id] = {
          id: p.user_id,
          name: `${u.first_name} ${u.last_name}`.trim() || u.email,
          initials: initials(u.first_name, u.last_name),
          avatarColor: pickColor(colorIdx++),
          online: u.status === "active",
          email: u.email,
        };
      } else {
        userMap[p.user_id] = {
          id: p.user_id,
          name: "Unknown User",
          initials: "??",
          avatarColor: pickColor(colorIdx++),
          online: false,
          email: "",
        };
      }
    }
  }

  // Fetch all messages for all conversations in one query
  const { data: rawMessages } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });

  const allMessages = rawMessages ?? [];

  // Build a lookup of last message per conversation
  const lastMessageByConv: Record<string, (typeof allMessages)[number]> = {};
  for (const msg of allMessages) {
    lastMessageByConv[msg.conversation_id] = msg; // last one wins since sorted asc
  }

  // Calculate unread counts per conversation
  const participantLastRead: Record<string, string | null> = {};
  for (const conv of conversations) {
    const myParticipant = (conv.conversation_participants ?? []).find(
      (p: { user_id: string }) => p.user_id === currentUserId
    );
    participantLastRead[conv.id] = myParticipant?.last_read_at ?? null;
  }

  // Map messages to the client interface
  const mappedMessages: MessageData[] = allMessages.map((msg) => {
    const convLastRead = participantLastRead[msg.conversation_id];
    const isRead =
      msg.sender_id === currentUserId ||
      (convLastRead != null &&
        new Date(msg.created_at) <= new Date(convLastRead));

    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      content: msg.content,
      messageType: msg.message_type as MessageData["messageType"],
      attachmentUrl: msg.attachment_url,
      attachmentName: msg.attachment_name,
      createdAt: msg.created_at,
      isRead,
    };
  });

  // Map conversations to the client interface
  const mappedConversations: ConversationData[] = conversations.map((conv) => {
    const lastRaw = lastMessageByConv[conv.id];
    const lastMessage: MessageData | null = lastRaw
      ? {
          id: lastRaw.id,
          conversationId: lastRaw.conversation_id,
          senderId: lastRaw.sender_id,
          content: lastRaw.content,
          messageType: lastRaw.message_type as MessageData["messageType"],
          attachmentUrl: lastRaw.attachment_url,
          attachmentName: lastRaw.attachment_name,
          createdAt: lastRaw.created_at,
          isRead: true,
        }
      : null;

    // Compute unread count
    const convLastRead = participantLastRead[conv.id];
    let unreadCount = 0;
    if (convLastRead) {
      unreadCount = allMessages.filter(
        (m) =>
          m.conversation_id === conv.id &&
          m.sender_id !== currentUserId &&
          new Date(m.created_at) > new Date(convLastRead)
      ).length;
    } else {
      // Never read -- all messages from others are unread
      unreadCount = allMessages.filter(
        (m) =>
          m.conversation_id === conv.id && m.sender_id !== currentUserId
      ).length;
    }

    return {
      id: conv.id,
      type: conv.type as "direct" | "group",
      title: conv.title,
      participantIds: (conv.conversation_participants ?? []).map(
        (p: { user_id: string }) => p.user_id
      ),
      lastMessage,
      unreadCount,
      updatedAt: conv.updated_at,
    };
  });

  return (
    <MessagesClient
      currentUserId={currentUserId}
      users={userMap}
      conversations={mappedConversations}
      messages={mappedMessages}
    />
  );
}
