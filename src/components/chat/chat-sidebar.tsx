"use client";

import {
  Plus,
  Trash2,
  MessageSquare,
  BookOpen,
  ClipboardCheck,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { ConversationListItem } from "@/components/ui/conversation-list-item";

interface Session {
  id: string;
  title: string;
  context_type: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface ChatSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
}

const CONTEXT_ICONS: Record<string, LucideIcon> = {
  general: MessageSquare,
  course: BookOpen,
  assessment: ClipboardCheck,
  career: Briefcase,
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: ChatSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-gray-500">No conversations yet</p>
            <p className="text-xs text-gray-500 mt-1">Start a new conversation to begin</p>
          </div>
        ) : (
          <div className="py-1">
            {sessions.map((session) => {
              const ContextIcon =
                CONTEXT_ICONS[session.context_type] || CONTEXT_ICONS.general;
              const active = activeSessionId === session.id;
              return (
              <ConversationListItem
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                active={active}
                activeAccent
                className="group gap-2.5 px-3 py-2.5 hover:bg-gray-100"
                leading={
                  <ContextIcon
                    className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      active ? "text-primary-600" : "text-gray-400"
                    }`}
                    strokeWidth={1.5}
                  />
                }
                trailing={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                }
              >
                <p
                  className={`text-sm font-medium truncate ${
                    active ? "text-primary-900" : "text-gray-900"
                  }`}
                >
                  {session.title || "New Conversation"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-gray-500">
                    {session.message_count} msgs
                  </span>
                  {session.last_message_at && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span className="text-[10px] text-gray-500">
                        {formatRelativeTime(session.last_message_at)}
                      </span>
                    </>
                  )}
                </div>
              </ConversationListItem>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
