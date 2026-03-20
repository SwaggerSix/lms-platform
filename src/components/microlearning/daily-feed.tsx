"use client";

import { useState, useEffect, useCallback } from "react";
import NuggetCard from "./nugget-card";

interface Nugget {
  id: string;
  title: string;
  content_type: "tip" | "flashcard" | "quiz" | "video_clip" | "infographic" | "checklist";
  content: Record<string, any>;
  difficulty?: string;
  estimated_seconds?: number;
  tags?: string[];
  view_count?: number;
  user_status?: string | null;
}

interface DailyFeedProps {
  initialNuggets?: Nugget[];
}

export default function DailyFeed({ initialNuggets = [] }: DailyFeedProps) {
  const [nuggets, setNuggets] = useState<Nugget[]>(initialNuggets);
  const [loading, setLoading] = useState(!initialNuggets.length);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchNuggets = useCallback(async (pageNum: number, filter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "10" });
      if (filter !== "all") params.set("content_type", filter);

      const res = await fetch(`/api/microlearning/nuggets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      if (pageNum === 1) {
        setNuggets(data.nuggets);
      } else {
        setNuggets((prev) => [...prev, ...data.nuggets]);
      }
      setHasMore(pageNum < data.totalPages);
    } catch (err) {
      console.error("Failed to load nuggets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialNuggets.length) {
      fetchNuggets(1, activeFilter);
    }
  }, [fetchNuggets, activeFilter, initialNuggets.length]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setPage(1);
    fetchNuggets(1, filter);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchNuggets(next, activeFilter);
  };

  const handleComplete = async (nuggetId: string, score?: number) => {
    try {
      await fetch("/api/microlearning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nugget_id: nuggetId, status: "completed", score }),
      });
      setNuggets((prev) =>
        prev.map((n) => (n.id === nuggetId ? { ...n, user_status: "completed" } : n))
      );
    } catch (err) {
      console.error("Failed to mark complete:", err);
    }
  };

  const handleBookmark = async (nuggetId: string) => {
    try {
      const nugget = nuggets.find((n) => n.id === nuggetId);
      const newStatus = nugget?.user_status === "bookmarked" ? "viewed" : "bookmarked";
      await fetch("/api/microlearning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nugget_id: nuggetId, status: newStatus }),
      });
      setNuggets((prev) =>
        prev.map((n) => (n.id === nuggetId ? { ...n, user_status: newStatus } : n))
      );
    } catch (err) {
      console.error("Failed to bookmark:", err);
    }
  };

  const filters = [
    { key: "all", label: "All" },
    { key: "tip", label: "Tips" },
    { key: "flashcard", label: "Flashcards" },
    { key: "quiz", label: "Quizzes" },
    { key: "video_clip", label: "Videos" },
    { key: "checklist", label: "Checklists" },
  ];

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeFilter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Nuggets Grid */}
      {loading && nuggets.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="h-16 bg-gray-200" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : nuggets.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📚</div>
          <h3 className="text-lg font-semibold text-gray-700">No nuggets yet</h3>
          <p className="text-sm text-gray-500 mt-1">Check back later for new microlearning content.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nuggets.map((nugget) => (
              <NuggetCard
                key={nugget.id}
                nugget={nugget}
                onComplete={handleComplete}
                onBookmark={handleBookmark}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
