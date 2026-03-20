"use client";

import { useState, useEffect, useCallback } from "react";
import ExternalCourseCard from "./external-course-card";

interface ExternalCourse {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string | null;
  external_url: string;
  duration_minutes?: number | null;
  difficulty?: string | null;
  topics?: string[];
  rating?: number | null;
  provider?: {
    id: string;
    name: string;
    provider_type: string;
  } | null;
  user_enrollment?: {
    status: string;
    progress: number;
  } | null;
}

interface InternalCourse {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string | null;
  difficulty_level?: string;
  estimated_duration?: number;
  slug?: string;
}

interface UnifiedCatalogProps {
  initialCourses?: ExternalCourse[];
  internalCourses?: InternalCourse[];
}

export default function UnifiedCatalog({ initialCourses = [], internalCourses = [] }: UnifiedCatalogProps) {
  const [externalCourses, setExternalCourses] = useState<ExternalCourse[]>(initialCourses);
  const [loading, setLoading] = useState(!initialCourses.length);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "internal" | "external">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchExternalCourses = useCallback(async (pageNum: number, searchQuery: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/marketplace/courses?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      if (pageNum === 1) {
        setExternalCourses(data.courses);
      } else {
        setExternalCourses((prev) => [...prev, ...data.courses]);
      }
      setHasMore(pageNum < data.totalPages);
    } catch (err) {
      console.error("Failed to load marketplace courses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialCourses.length) {
      fetchExternalCourses(1, search);
    }
  }, [fetchExternalCourses, search, initialCourses.length]);

  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
    fetchExternalCourses(1, query);
  };

  const handleEnroll = async (courseId: string) => {
    try {
      const res = await fetch("/api/marketplace/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace_course_id: courseId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to enroll");
      }

      const data = await res.json();

      // Update local state
      setExternalCourses((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? { ...c, user_enrollment: { status: "enrolled", progress: 0 } }
            : c
        )
      );

      // Open external URL
      if (data.external_url) {
        window.open(data.external_url, "_blank");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter internal courses based on search
  const filteredInternal = internalCourses.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (difficultyFilter !== "all" && c.difficulty_level !== difficultyFilter) return false;
    return true;
  });

  const filteredExternal = externalCourses.filter((c) => {
    if (difficultyFilter !== "all" && c.difficulty !== difficultyFilter) return false;
    return true;
  });

  return (
    <div>
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search all courses..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Sources</option>
            <option value="internal">Internal Courses</option>
            <option value="external">External (Marketplace)</option>
          </select>

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Internal Courses Section */}
      {sourceFilter !== "external" && filteredInternal.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Internal Courses
            <span className="text-sm font-normal text-gray-500">({filteredInternal.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredInternal.map((course) => (
              <a
                key={course.id}
                href={`/learn/catalog/${course.slug || course.id}`}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group block"
              >
                <div className="aspect-video bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <svg className="w-10 h-10 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                    </svg>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Internal
                    </span>
                    {course.difficulty_level && (
                      <span className="text-xs text-gray-500 capitalize">{course.difficulty_level}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{course.title}</h3>
                  {course.estimated_duration && (
                    <p className="text-xs text-gray-500 mt-1">{course.estimated_duration} min</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* External Courses Section */}
      {sourceFilter !== "internal" && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full" />
            External Courses
            <span className="text-sm font-normal text-gray-500">({filteredExternal.length})</span>
          </h2>

          {loading && filteredExternal.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="aspect-video bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-8 bg-gray-200 rounded mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredExternal.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-500 text-sm">No external courses found. Set up providers in Admin to sync catalogs.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredExternal.map((course) => (
                  <ExternalCourseCard
                    key={course.id}
                    course={course}
                    onEnroll={handleEnroll}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => {
                      const next = page + 1;
                      setPage(next);
                      fetchExternalCourses(next, search);
                    }}
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
      )}
    </div>
  );
}
