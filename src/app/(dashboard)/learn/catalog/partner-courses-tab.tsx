"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import ExternalCourseCard from "@/components/marketplace/external-course-card";

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

/**
 * Partner-content tab of the unified catalog: external marketplace courses
 * synced from content providers. Self-loads on mount and re-queries when the
 * shared catalog search changes.
 */
export default function PartnerCoursesTab({ search }: { search: string }) {
  const [courses, setCourses] = useState<ExternalCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchCourses = useCallback(async (pageNum: number, searchQuery: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/marketplace/courses?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCourses((prev) => (pageNum === 1 ? data.courses : [...prev, ...data.courses]));
      setHasMore(pageNum < data.totalPages);
    } catch (err) {
      console.error("Failed to load partner courses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + debounced re-query when the shared search changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchCourses(1, search);
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, fetchCourses]);

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
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? { ...c, user_enrollment: { status: "enrolled", progress: 0 } }
            : c
        )
      );
      if (data.external_url) {
        window.open(data.external_url, "_blank");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to enroll");
    }
  };

  const filtered = courses.filter(
    (c) => difficulty === "all" || c.difficulty === difficulty
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Courses from partner content providers. Enrolling opens the course on
          the provider&apos;s site; completion is tracked here.
        </p>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          aria-label="Filter by difficulty"
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          <option value="all">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {loading && filtered.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-gray-100 bg-white">
              <div className="aspect-video bg-gray-200" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="mt-3 h-8 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-10 w-10" aria-hidden="true" />}
          title="No partner courses found"
          description={
            search || difficulty !== "all"
              ? "Try adjusting your search or difficulty filter."
              : "Partner courses appear here once content providers are set up and synced."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((course) => (
              <ExternalCourseCard key={course.id} course={course} onEnroll={handleEnroll} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                loading={loading}
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  fetchCourses(next, search);
                }}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
