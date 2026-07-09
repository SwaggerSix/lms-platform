"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  Send,
  X,
  File,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Users,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Avatar as UIAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MessageBubble } from "@/components/ui/message-bubble";
import { ConversationListItem } from "@/components/ui/conversation-list-item";
import { useRealtimeSubscription, useRealtimeBroadcast } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types (exported for server component mapping)                      */
/* ------------------------------------------------------------------ */

export interface MessageUser {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  online: boolean;
  email: string;
}

const RECIPIENT_AVATAR_COLORS = [
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

function toRecipientUser(u: {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}, index: number): MessageUser {
  const first = u.first_name ?? "";
  const last = u.last_name ?? "";
  const name = `${first} ${last}`.trim() || (u.email ?? "Unknown");
  const initials =
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "??";
  return {
    id: u.id,
    name,
    email: u.email ?? "",
    initials,
    avatarColor: RECIPIENT_AVATAR_COLORS[index % RECIPIENT_AVATAR_COLORS.length],
    online: true,
  };
}

export interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: "text" | "file" | "image" | "system";
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string; // ISO string from server
  isRead: boolean;
}

export interface ConversationData {
  id: string;
  type: "direct" | "group";
  title: string | null;
  participantIds: string[];
  lastMessage: MessageData | null;
  unreadCount: number;
  updatedAt: string; // ISO string from server
}

export interface MessagesClientProps {
  currentUserId: string;
  users: Record<string, MessageUser>;
  conversations: ConversationData[];
  messages: MessageData[];
  /** The current user's direct reports, for managers to quickly message their team. */
  teamMembers?: MessageUser[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

/* ------------------------------------------------------------------ */
/*  Sub-Components                                                     */
/* ------------------------------------------------------------------ */

function Avatar({
  user,
  size = "md",
  showOnline = false,
}: {
  user: MessageUser;
  size?: "sm" | "md" | "lg";
  showOnline?: boolean;
}) {
  const dotSizes = { sm: "h-2 w-2", md: "h-2.5 w-2.5", lg: "h-3 w-3" };

  return (
    <div className="relative flex-shrink-0">
      <UIAvatar
        size={size}
        fallback={user.initials}
        colorClass={cn(user.avatarColor, "text-white")}
        className={cn("font-semibold", size === "lg" && "h-12 w-12 text-base")}
      />
      {showOnline && user.online && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white bg-green-500",
            dotSizes[size]
          )}
        />
      )}
    </div>
  );
}

function FileAttachment({ name, type }: { name: string; type: "file" | "image" }) {
  if (type === "image") {
    return (
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <ImageIcon className="h-5 w-5 text-primary-500" />
        <span className="text-sm text-gray-700">{name}</span>
      </div>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <File className="h-5 w-5 text-primary-500" />
      <span className="text-sm text-gray-700">{name}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New Message Modal                                                  */
/* ------------------------------------------------------------------ */

function NewMessageModal({
  currentUserId,
  teamMembers,
  onClose,
  onSend,
}: {
  currentUserId: string;
  teamMembers: MessageUser[];
  onClose: () => void;
  onSend: (recipients: MessageUser[], message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<MessageUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<MessageUser[]>([]);
  const [message, setMessage] = useState("");

  const selectedIds = selectedUsers.map((u) => u.id);

  const addUsers = (toAdd: MessageUser[]) =>
    setSelectedUsers((prev) => {
      const have = new Set(prev.map((u) => u.id));
      return [...prev, ...toAdd.filter((u) => !have.has(u.id))];
    });

  const unselectedTeam = teamMembers.filter((m) => !selectedIds.includes(m.id));

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/messages/recipients?search=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (!active) return;
        setResults(
          (data.users ?? []).map((u: any, i: number) => toRecipientUser(u, i))
        );
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  const filtered = results.filter(
    (u) => u.id !== currentUserId && !selectedIds.includes(u.id)
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New Message"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedUsers.length > 0 && message.trim()) {
                onSend(selectedUsers, message.trim());
              }
            }}
            disabled={selectedUsers.length === 0 || !message.trim()}
          >
            Send Message
          </Button>
        </>
      }
    >
        <div>
          {/* Selected recipients */}
          {selectedUsers.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700"
                >
                  {user.name}
                  <button
                    onClick={() =>
                      setSelectedUsers((prev) =>
                        prev.filter((s) => s.id !== user.id)
                      )
                    }
                    aria-label={`Remove ${user.name}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Quick-add the manager's team */}
          {teamMembers.length > 0 && (
            <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Your team
                </span>
                <button
                  onClick={() => addUsers(teamMembers)}
                  disabled={unselectedTeam.length === 0}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  Add entire team ({teamMembers.length})
                </button>
              </div>
              {unselectedTeam.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unselectedTeam.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => addUsers([m])}
                      className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-primary-50 hover:text-primary-700"
                    >
                      + {m.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  Everyone on your team is added.
                </p>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* User list */}
          <div className="mb-4 max-h-48 space-y-1 overflow-y-auto">
            {filtered.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUsers((prev) => [...prev, user])}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
              >
                <Avatar user={user} size="sm" showOnline />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </button>
            ))}
            {searching && (
              <p className="py-4 text-center text-sm text-gray-500">
                Searching...
              </p>
            )}
            {!searching && search.trim() === "" && (
              <p className="py-4 text-center text-sm text-gray-500">
                Start typing a name or email to find people.
              </p>
            )}
            {!searching && search.trim() !== "" && filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">
                No users found
              </p>
            )}
          </div>

          {/* Message */}
          <textarea
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Client Component                                              */
/* ------------------------------------------------------------------ */

export default function MessagesClient({
  currentUserId,
  users: initialUsers,
  conversations: initialConversations,
  messages: initialMessages,
  teamMembers = [],
}: MessagesClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState(initialMessages);
  const [activeConvId, setActiveConvId] = useState<string>(
    initialConversations[0]?.id ?? ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Supabase client (stable across renders) ---
  const supabase = useMemo(() => createClient(), []);

  // Collect all conversation ids the user participates in
  const conversationIds = useMemo(
    () => conversations.map((c) => c.id),
    [conversations]
  );

  // --- Real-time: new messages ---
  useRealtimeSubscription(supabase, {
    table: "messages",
    event: "INSERT",
    onData: useCallback(
      (payload: { eventType: string; new: Record<string, unknown> }) => {
        const row = payload.new;
        const convId = row.conversation_id as string;
        // Ignore messages for conversations the user is not part of
        if (!conversationIds.includes(convId)) return;
        // Ignore messages sent by the current user (already added optimistically)
        if ((row.sender_id as string) === currentUserId) return;

        const incoming: MessageData = {
          id: row.id as string,
          conversationId: convId,
          senderId: row.sender_id as string,
          content: row.content as string,
          messageType: (row.message_type as MessageData["messageType"]) || "text",
          attachmentUrl: (row.attachment_url as string) || null,
          attachmentName: (row.attachment_name as string) || null,
          createdAt: row.created_at as string,
          isRead: false,
        };

        setMessages((prev) => [...prev, incoming]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMessage: incoming,
                  updatedAt: incoming.createdAt,
                  unreadCount: c.id === activeConvId ? c.unreadCount : c.unreadCount + 1,
                }
              : c
          )
        );
      },
      [conversationIds, currentUserId, activeConvId]
    ),
  });

  // --- Real-time: typing indicators via broadcast ---
  const typingChannelName = activeConvId
    ? `typing:${activeConvId}`
    : "typing:noop";

  const { send: sendTypingBroadcast } = useRealtimeBroadcast(
    supabase,
    typingChannelName,
    "typing",
    useCallback(
      (payload: Record<string, unknown>) => {
        const senderId = payload.userId as string;
        if (senderId === currentUserId) return;
        setTypingUser(senderId);
        // Clear typing indicator after 3 seconds of no new events
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
      },
      [currentUserId]
    )
  );

  // Broadcast typing when the user types
  const handleInputChange = useCallback(
    (value: string) => {
      setInputText(value);
      if (value.trim()) {
        sendTypingBroadcast({ userId: currentUserId });
      }
    },
    [sendTypingBroadcast, currentUserId]
  );

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const activeMessages = messages
    .filter((m) => m.conversationId === activeConvId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  const filteredConversations = conversations
    .filter((c) => {
      if (!searchQuery) return true;
      const name = getConversationName(c).toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  function getOtherUser(conv: ConversationData): MessageUser {
    const otherId = conv.participantIds.find((id) => id !== currentUserId);
    return users[otherId || ""] || {
      id: "",
      name: "Unknown",
      initials: "??",
      avatarColor: "bg-gray-500",
      online: false,
      email: "",
    };
  }

  function getConversationName(conv: ConversationData): string {
    if (conv.type === "group" && conv.title) return conv.title;
    return getOtherUser(conv).name;
  }

  function getConversationAvatar(conv: ConversationData): MessageUser {
    if (conv.type === "group") {
      return {
        id: "group",
        name: conv.title || "Group",
        initials: (conv.title || "GR").slice(0, 2).toUpperCase(),
        avatarColor: "bg-violet-500",
        online: true,
        email: "",
      };
    }
    return getOtherUser(conv);
  }

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [activeMessages.length, activeConvId]);

  // Reset typing indicator when switching conversations
  useEffect(() => {
    setTypingUser(null);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeConvId]);

  function handleSelectConversation(convId: string) {
    setActiveConvId(convId);
    // Optimistically mark as read locally, then persist to API
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
    setMessages((prev) =>
      prev.map((m) =>
        m.conversationId === convId ? { ...m, isRead: true } : m
      )
    );
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId }),
    }).catch(() => {
      // Silently fail for mark-as-read; not critical
    });
  }

  async function handleSendMessage() {
    if (!inputText.trim() || !activeConv) return;
    const content = inputText.trim();
    setInputText("");

    const now = new Date().toISOString();
    const tempId = `m${Date.now()}`;
    const optimisticMsg: MessageData = {
      id: tempId,
      conversationId: activeConv.id,
      senderId: currentUserId,
      content,
      messageType: "text",
      attachmentUrl: null,
      attachmentName: null,
      createdAt: now,
      isRead: false,
    };

    // Optimistically add
    setMessages((prev) => [...prev, optimisticMsg]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? { ...c, lastMessage: optimisticMsg, updatedAt: now }
          : c
      )
    );

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConv.id,
          content,
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const { message: saved } = await res.json();
      // Replace temp message with server version
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: saved.id,
                createdAt: saved.created_at,
              }
            : m
        )
      );
    } catch {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  }

  async function handleNewMessageSend(recipients: MessageUser[], message: string) {
    const recipientIds = recipients.map((r) => r.id);
    // Merge newly-found recipients into the user map so their names/avatars render.
    setUsers((prev) => {
      const next = { ...prev };
      for (const r of recipients) next[r.id] = r;
      return next;
    });

    const existing = conversations.find(
      (c) =>
        c.type === "direct" &&
        recipientIds.length === 1 &&
        c.participantIds.includes(recipientIds[0])
    );

    const now = new Date().toISOString();
    setShowNewMessage(false);

    if (existing) {
      // Send to existing conversation
      const tempId = `m${Date.now()}`;
      const optimisticMsg: MessageData = {
        id: tempId,
        conversationId: existing.id,
        senderId: currentUserId,
        content: message,
        messageType: "text",
        attachmentUrl: null,
        attachmentName: null,
        createdAt: now,
        isRead: false,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === existing.id
            ? { ...c, lastMessage: optimisticMsg, updatedAt: now }
            : c
        )
      );
      setActiveConvId(existing.id);

      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: existing.id,
            content: message,
          }),
        });
        if (!res.ok) throw new Error("Failed to send");
        const { message: saved } = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, id: saved.id, createdAt: saved.created_at }
              : m
          )
        );
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } else {
      // Create new conversation via API, then send message
      try {
        const convRes = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_conversation",
            participant_ids: recipientIds,
            type: recipientIds.length > 1 ? "group" : "direct",
            title: recipientIds.length > 1 ? "New Group" : null,
          }),
        });
        if (!convRes.ok) throw new Error("Failed to create conversation");
        const { conversation: serverConv } = await convRes.json();

        // Now send the first message
        const msgRes = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: serverConv.id,
            content: message,
          }),
        });
        if (!msgRes.ok) throw new Error("Failed to send message");
        const { message: savedMsg } = await msgRes.json();

        const newMsg: MessageData = {
          id: savedMsg.id,
          conversationId: serverConv.id,
          senderId: currentUserId,
          content: message,
          messageType: "text",
          attachmentUrl: null,
          attachmentName: null,
          createdAt: savedMsg.created_at,
          isRead: false,
        };
        const newConv: ConversationData = {
          id: serverConv.id,
          type: recipientIds.length > 1 ? "group" : "direct",
          title: recipientIds.length > 1 ? "New Group" : null,
          participantIds: [currentUserId, ...recipientIds],
          lastMessage: newMsg,
          unreadCount: 0,
          updatedAt: serverConv.updated_at || now,
        };
        setConversations((prev) => [newConv, ...prev]);
        setMessages((prev) => [...prev, newMsg]);
        setActiveConvId(serverConv.id);
      } catch {
        // Could show an error toast here; for now just log
        console.error("Failed to create conversation");
      }
    }
  }

  // Group messages by date
  const groupedMessages: { label: string; messages: MessageData[] }[] = [];
  let currentLabel = "";
  for (const msg of activeMessages) {
    const label = dateLabel(msg.createdAt);
    if (label !== currentLabel) {
      currentLabel = label;
      groupedMessages.push({ label, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ---- Left Panel: Conversation List ----
          On mobile the list and the thread stack: the list fills the screen
          until a conversation is opened, then the thread takes over with a
          back button. From md up they render side by side. */}
      <div
        className={cn(
          "w-full flex-col border-r border-gray-200 md:flex md:w-80",
          activeConv ? "hidden" : "flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <h1 className="text-lg font-bold text-gray-900">Messages</h1>
          <Button size="sm" onClick={() => setShowNewMessage(true)}>
            <Plus className="h-4 w-4" />
            New Message
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <MessageSquare className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-500">No conversations yet</p>
              <p className="mt-1 text-xs text-gray-500">Start a conversation with a colleague.</p>
              <Button size="sm" className="mt-3" onClick={() => setShowNewMessage(true)}>
                <Plus className="h-4 w-4" />
                New Message
              </Button>
            </div>
          )}
          {filteredConversations.map((conv) => {
            const avatar = getConversationAvatar(conv);
            const name = getConversationName(conv);
            const isActive = conv.id === activeConvId;
            const hasUnread = conv.unreadCount > 0;
            const lastMsg = conv.lastMessage;

            let preview = "";
            if (lastMsg) {
              const sender =
                lastMsg.senderId === currentUserId
                  ? "You"
                  : users[lastMsg.senderId]?.name.split(" ")[0] || "";
              if (lastMsg.messageType === "system") {
                preview = lastMsg.content;
              } else if (
                lastMsg.messageType === "file" ||
                lastMsg.messageType === "image"
              ) {
                preview = `${sender}: Sent a ${lastMsg.messageType === "image" ? "photo" : "file"}`;
              } else {
                preview =
                  conv.type === "group"
                    ? `${sender}: ${lastMsg.content}`
                    : lastMsg.senderId === currentUserId
                      ? `You: ${lastMsg.content}`
                      : lastMsg.content;
              }
            }

            return (
              <ConversationListItem
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                active={isActive}
                leading={
                  <Avatar
                    user={avatar}
                    size="md"
                    showOnline={conv.type === "direct"}
                  />
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "truncate text-sm",
                      hasUnread
                        ? "font-bold text-gray-900"
                        : "font-medium text-gray-900"
                    )}
                  >
                    {name}
                  </span>
                  <span className="ml-2 flex-shrink-0 text-xs text-gray-500">
                    {lastMsg ? relativeTime(lastMsg.createdAt) : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "truncate text-xs",
                      hasUnread
                        ? "font-semibold text-gray-800"
                        : "text-gray-500"
                    )}
                  >
                    {truncate(preview, 45)}
                  </p>
                  {hasUnread && (
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </ConversationListItem>
            );
          })}
        </div>
      </div>

      {/* ---- Right Panel: Active Conversation ---- */}
      {activeConv ? (
        <div className="flex flex-1 flex-col">
          {/* Conversation header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveConvId("")}
                aria-label="Back to conversations"
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 md:hidden"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <Avatar
                user={getConversationAvatar(activeConv)}
                size="md"
                showOnline={activeConv.type === "direct"}
              />
              <div>
                <h2 className="font-semibold text-gray-900">
                  {getConversationName(activeConv)}
                </h2>
                {activeConv.type === "direct" ? (
                  <p className="text-xs text-gray-500">
                    {getOtherUser(activeConv).online ? (
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                        Online
                      </span>
                    ) : (
                      "Offline"
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {activeConv.participantIds.length} members
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {groupedMessages.map((group) => (
              <div key={group.label}>
                {/* Date separator */}
                <div className="my-4 flex items-center gap-4">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs font-medium text-gray-500">
                    {group.label}
                  </span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>

                {/* Messages */}
                {group.messages.map((msg) => {
                  const isMine = msg.senderId === currentUserId;
                  const isSystem = msg.messageType === "system";
                  const sender = users[msg.senderId];
                  const time = new Date(msg.createdAt).toLocaleTimeString(
                    "en-US",
                    {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    }
                  );

                  if (isSystem) {
                    return (
                      <div
                        key={msg.id}
                        className="my-3 text-center text-xs italic text-gray-500"
                      >
                        {msg.content}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="mb-3">
                      <MessageBubble
                        mine={isMine}
                        maxWidthClass="max-w-[70%]"
                        avatar={
                          !isMine && sender ? (
                            <Avatar user={sender} size="sm" />
                          ) : undefined
                        }
                        meta={
                          !isMine && activeConv.type === "group" && sender ? (
                            <p className="mb-0.5 text-xs font-medium text-gray-600">
                              {sender.name}
                            </p>
                          ) : undefined
                        }
                        footer={
                          <div
                            className={cn(
                              "mt-1 flex items-center gap-1 text-[11px] text-gray-500",
                              isMine ? "justify-end" : "justify-start"
                            )}
                          >
                            <span>{time}</span>
                            {isMine && (
                              <span>
                                {msg.isRead ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-primary-500" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </span>
                            )}
                          </div>
                        }
                      >
                        {msg.messageType === "text" && (
                          <p className="text-sm">{msg.content}</p>
                        )}
                        {(msg.messageType === "file" ||
                          msg.messageType === "image") && (
                          <FileAttachment
                            name={msg.attachmentName || msg.content}
                            type={msg.messageType}
                          />
                        )}
                      </MessageBubble>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Typing indicator */}
            {typingUser && users[typingUser] && (
              <div className="flex items-center gap-2 py-2">
                <Avatar user={users[typingUser]} size="sm" />
                <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs italic text-gray-500">
                      {users[typingUser].name.split(" ")[0]} is typing
                    </span>
                    <span className="flex gap-0.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                aria-label="Send message"
                className="mb-0.5 rounded-lg bg-primary-600 p-2.5 text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state (desktop only — on mobile the list fills the screen) */
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center">
            <MessageSquare className="mx-auto h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Select a conversation
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Choose a conversation from the sidebar or start a new one.
            </p>
          </div>
        </div>
      )}

      {/* New Message Modal */}
      {showNewMessage && (
        <NewMessageModal
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          onClose={() => setShowNewMessage(false)}
          onSend={handleNewMessageSend}
        />
      )}
    </div>
  );
}
