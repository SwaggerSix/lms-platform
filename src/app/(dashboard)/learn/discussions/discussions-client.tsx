"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ChevronUp as UpArrow,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  X,
  Send,
  Clock,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { trackEvent } from "@/lib/analytics/track";
import { useToast } from "@/components/ui/toast";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Reply {
  id: string;
  author: string;
  initials: string;
  text: string;
  timeAgo: string;
}

export interface Thread {
  id: string;
  title: string;
  body: string;
  author: string;
  authorInitials: string;
  course: string;
  courseColor: string;
  timeAgo: string;
  replies: number;
  upvotes: number;
  mockReplies: Reply[];
}

export interface DiscussionsClientProps {
  threads: Thread[];
  currentUserInitials: string;
  currentUserName: string;
}

type TabFilter = "All Discussions" | "My Posts" | "Unanswered";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DiscussionsClient({
  threads,
  currentUserInitials,
  currentUserName,
}: DiscussionsClientProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("All Discussions");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const router = useRouter();
  const toast = useToast();

  /* ---- Post new discussion ---- */
  const handlePostDiscussion = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_thread",
          title: newTitle,
          body: newBody,
          course: newCourse || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create discussion");
      setNewTitle("");
      setNewCourse("");
      setNewBody("");
      setShowNewForm(false);
      trackEvent("discussion_posted");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to post discussion. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Reply to a thread ---- */
  const handleReply = async (threadId: string) => {
    const text = replyTexts[threadId]?.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          thread_id: threadId,
          body: text,
        }),
      });
      if (!res.ok) throw new Error("Failed to post reply");
      setReplyTexts((prev) => ({ ...prev, [threadId]: "" }));
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to post reply. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Upvote a thread ---- */
  const handleUpvote = async (discussionId: string) => {
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upvote",
          discussion_id: discussionId,
        }),
      });
      if (!res.ok) throw new Error("Failed to upvote");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredThreads = threads.filter((t) => {
    if (activeTab === "My Posts") return t.author === currentUserName;
    if (activeTab === "Unanswered") return t.replies === 0;
    return true;
  }).filter((t) =>
    searchQuery === "" ||
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredThreads.length / pageSize));
  const paginatedThreads = filteredThreads.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showStart = (currentPage - 1) * pageSize;
  const showEnd = Math.min(currentPage * pageSize, filteredThreads.length);

  const getPageNumbers = () => {
    const pages: number[] = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discussions</h1>
            <p className="mt-1 text-sm text-gray-500">Ask questions, share knowledge, and connect with peers.</p>
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {showNewForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showNewForm ? "Cancel" : "New Discussion"}
          </button>
        </div>

        {/* ---- New Discussion Form ---- */}
        {showNewForm && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Start a New Discussion</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="discussion-title" className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
                <input
                  id="discussion-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What's your question or topic?"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                />
              </div>
              <div>
                <label htmlFor="discussion-course" className="mb-1.5 block text-sm font-medium text-gray-700">Course</label>
                <select
                  id="discussion-course"
                  value={newCourse}
                  onChange={(e) => setNewCourse(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <option value="">Select a course...</option>
                  <option value="data-science">Data Science</option>
                  <option value="leadership">Leadership</option>
                  <option value="project-management">Project Management</option>
                  <option value="safety">Safety</option>
                  <option value="cloud-architecture">Cloud Architecture</option>
                </select>
              </div>
              <div>
                <label htmlFor="discussion-body" className="mb-1.5 block text-sm font-medium text-gray-700">Body</label>
                <textarea
                  id="discussion-body"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={5}
                  placeholder="Share the details of your question or discussion topic..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                />
              </div>
              <div>
                <label htmlFor="discussion-tags" className="mb-1.5 block text-sm font-medium text-gray-700">Tags</label>
                <input
                  id="discussion-tags"
                  type="text"
                  placeholder="e.g. python, beginner, best-practices"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                />
              </div>
              <button
                onClick={handlePostDiscussion}
                disabled={submitting || !newTitle.trim() || !newBody.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Posting..." : "Post Discussion"}
              </button>
            </div>
          </div>
        )}

        {/* ---- Tabs & Search ---- */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(["All Discussions", "My Posts", "Unanswered"] as TabFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search discussions..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-64"
            />
          </div>
        </div>

        {/* ---- Thread List ---- */}
        <div className="mt-6 space-y-3">
          {paginatedThreads.map((thread) => {
            const isExpanded = expandedThread === thread.id;
            return (
              <div
                key={thread.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Thread Card */}
                <div className="flex gap-4 p-5">
                  {/* Upvote */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleUpvote(thread.id)}
                      aria-label={`Upvote, ${thread.upvotes} votes`}
                      className="rounded-md p-1 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <UpArrow className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="text-sm font-semibold text-gray-700">{thread.upvotes}</span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => setExpandedThread(isExpanded ? null : thread.id)}
                      className="text-left"
                    >
                      <h3 className="text-base font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
                        {thread.title}
                      </h3>
                    </button>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{thread.body}</p>

                    {/* Meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-700">
                          {thread.authorInitials}
                        </div>
                        <span>{thread.author}</span>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", thread.courseColor)}>
                        {thread.course}
                      </span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{thread.timeAgo}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{thread.replies} replies</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded: Full body + replies */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Full body */}
                    <div className="bg-gray-50 px-5 py-4">
                      <p className="text-sm leading-relaxed text-gray-700">{thread.body}</p>
                    </div>

                    {/* Replies */}
                    <div className="divide-y divide-gray-100">
                      {thread.mockReplies.map((reply) => (
                        <div key={reply.id} className="flex gap-3 px-5 py-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                            {reply.initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{reply.author}</span>
                              <span className="text-xs text-gray-400">{reply.timeAgo}</span>
                            </div>
                            <p className="mt-1 text-sm text-gray-600">{reply.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply input */}
                    <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                        {currentUserInitials}
                      </div>
                      <input
                        type="text"
                        placeholder="Write a reply..."
                        value={replyTexts[thread.id] ?? ""}
                        onChange={(e) =>
                          setReplyTexts((prev) => ({ ...prev, [thread.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleReply(thread.id);
                          }
                        }}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      />
                      <button
                        onClick={() => handleReply(thread.id)}
                        disabled={submitting || !replyTexts[thread.id]?.trim()}
                        aria-label="Send reply"
                        className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredThreads.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
              <MessageSquare className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-500">No discussions found</p>
              <p className="mt-1 text-sm text-gray-400">Try adjusting your search or start a new discussion.</p>
              <button
                onClick={() => { setShowNewForm(true); setSearchQuery(""); }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                New Discussion
              </button>
            </div>
          )}

          {/* Pagination */}
          {filteredThreads.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                Showing {showStart + 1}-{showEnd} of {filteredThreads.length} discussions
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                {getPageNumbers().map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium",
                      currentPage === p ? "bg-indigo-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
