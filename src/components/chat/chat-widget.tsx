"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ChatMessage from "./chat-message";
import ChatInput from "./chat-input";
import ChatSidebar from "./chat-sidebar";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  context_type: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface ChatWidgetProps {
  /** If true, renders as a floating widget. If false, renders as a full-page component. */
  inline?: boolean;
  /** Pre-set context for the chat session */
  contextType?: "general" | "course" | "assessment" | "career";
  contextCourseId?: string;
}

const DEFAULT_PROMPTS = [
  "Help me create a study plan",
  "Explain a concept to me",
  "What should I learn next?",
  "Help me prepare for an assessment",
];

export default function ChatWidget({
  inline = false,
  contextType = "general",
  contextCourseId,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(inline);
  const [showSidebar, setShowSidebar] = useState(inline);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions?limit=50");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadSessions();
  }, [isOpen, loadSessions]);

  // Load messages for active session
  const loadMessages = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
    else setMessages([]);
  }, [activeSessionId, loadMessages]);

  // Create new session
  const createSession = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_type: contextType,
          context_course_id: contextCourseId || null,
        }),
      });
      if (res.ok) {
        const session = await res.json();
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  }, [contextType, contextCourseId]);

  // Delete session
  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [activeSessionId]
  );

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      let sessionId = activeSessionId;

      // Auto-create session if none active
      if (!sessionId) {
        try {
          const res = await fetch("/api/chat/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context_type: contextType,
              context_course_id: contextCourseId || null,
            }),
          });
          if (res.ok) {
            const session = await res.json();
            setSessions((prev) => [session, ...prev]);
            setActiveSessionId(session.id);
            sessionId = session.id;
          }
        } catch (err) {
          console.error("Failed to create session:", err);
          return;
        }
      }

      if (!sessionId) return;

      // Optimistic: add user message
      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setIsSending(true);

      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (res.ok) {
          const data = await res.json();
          // Replace temp message with real ones
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id);
            return [...withoutTemp, data.userMessage, data.assistantMessage];
          });

          // Update session in list
          if (data.session) {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === sessionId
                  ? { ...s, ...data.session }
                  : s
              )
            );
          }
        } else {
          // Remove optimistic message on error
          setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        }
      } catch (err) {
        console.error("Failed to send message:", err);
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      } finally {
        setIsSending(false);
      }
    },
    [activeSessionId, contextType, contextCourseId]
  );

  // Floating widget toggle
  if (!inline && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 flex items-center justify-center"
        aria-label="Open chat"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        {/* Notification dot */}
        <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
      </button>
    );
  }

  const containerClass = inline
    ? "flex h-full bg-white rounded-xl border border-gray-200 overflow-hidden"
    : "fixed bottom-6 right-6 z-50 w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex overflow-hidden";

  return (
    <div className={containerClass}>
      {/* Sidebar */}
      {showSidebar && (
        <div className={inline ? "w-72 flex-shrink-0" : "w-56 flex-shrink-0"}>
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onNewSession={createSession}
            onDeleteSession={deleteSession}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <h3 className="font-semibold text-gray-900 text-sm">Learning Assistant</h3>
            </div>
          </div>
          {!inline && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 text-base">
                Hi! I&apos;m your learning assistant
              </h4>
              <p className="text-sm text-gray-500 mt-1 max-w-[280px]">
                Ask me anything about your courses, study strategies, or career development.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.created_at}
                />
              ))}
              {isSending && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    AI
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-4 py-3 bg-white">
          <ChatInput
            onSend={sendMessage}
            disabled={isSending}
            suggestedPrompts={messages.length === 0 ? DEFAULT_PROMPTS : undefined}
          />
        </div>
      </div>
    </div>
  );
}
