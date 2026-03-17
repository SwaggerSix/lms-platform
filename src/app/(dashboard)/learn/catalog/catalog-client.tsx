"use client";

import { useState, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  Star,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  BookOpen,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDuration, formatNumber } from "@/utils/format";

type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type CourseType = "Video" | "Interactive" | "Document" | "Blended";

export interface CatalogCourse {
  id: string;
  slug: string;
  title: string;
  description: string;
  instructor: string;
  difficulty: Difficulty;
  type: CourseType;
  duration: number;
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  category: string;
  gradient: string;
  createdAt: string;
}

const CATEGORIES = ["Technology", "Leadership", "Business", "Compliance", "Soft Skills"];
const COURSE_TYPES: CourseType[] = ["Video", "Interactive", "Document", "Blended"];
const DIFFICULTIES: Difficulty[] = ["Beginner", "Intermediate", "Advanced"];
const SORT_OPTIONS = [
  { label: "Most Popular", value: "popular" },
  { label: "Newest", value: "newest" },
  { label: "Highest Rated", value: "rating" },
  { label: "Duration", value: "duration" },
];

const ITEMS_PER_PAGE = 6;

// Gradient map for courses without a thumbnail
const GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-red-500 to-rose-600",
  "from-green-500 to-emerald-600",
  "from-purple-500 to-violet-600",
  "from-cyan-500 to-blue-600",
  "from-slate-600 to-gray-800",
  "from-pink-500 to-rose-600",
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-purple-600",
  "from-yellow-500 to-amber-600",
  "from-sky-500 to-blue-600",
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3.5 w-3.5",
            star <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const colors = {
    Beginner: "bg-green-100 text-green-700",
    Intermediate: "bg-yellow-100 text-yellow-700",
    Advanced: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", colors[difficulty])}>
      {difficulty}
    </span>
  );
}

// Map difficulty levels
function mapDifficulty(level: string): Difficulty {
  const map: Record<string, Difficulty> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };
  return map[level?.toLowerCase()] ?? "Beginner";
}

// Map course types
function mapCourseType(type: string): CourseType {
  const map: Record<string, CourseType> = {
    self_paced: "Video",
    instructor_led: "Interactive",
    blended: "Blended",
    scorm: "Document",
    external: "Document",
  };
  return map[type] ?? "Video";
}

export default function CatalogClient({ courses }: { courses: CatalogCourse[] }) {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | "">("");
  const [selectedTypes, setSelectedTypes] = useState<CourseType[]>([]);
  const [sortBy, setSortBy] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const filteredCourses = useMemo(() => {
    let result = [...courses];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.instructor.toLowerCase().includes(q)
      );
    }
    if (selectedCategories.length > 0) {
      result = result.filter((c) => selectedCategories.includes(c.category));
    }
    if (selectedDifficulty) {
      result = result.filter((c) => c.difficulty === selectedDifficulty);
    }
    if (selectedTypes.length > 0) {
      result = result.filter((c) => selectedTypes.includes(c.type));
    }

    switch (sortBy) {
      case "popular":
        result.sort((a, b) => b.enrolledCount - a.enrolledCount);
        break;
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "duration":
        result.sort((a, b) => a.duration - b.duration);
        break;
    }

    return result;
  }, [courses, search, selectedCategories, selectedDifficulty, selectedTypes, sortBy]);

  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setCurrentPage(1);
  };

  const toggleType = (type: CourseType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedDifficulty("");
    setSelectedTypes([]);
    setSearch("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedCategories.length > 0 || selectedDifficulty !== "" || selectedTypes.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Explore Our Learning Catalog</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-indigo-100">
            Discover courses to advance your career, build new skills, and achieve your professional goals.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search courses, instructors, or topics..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border-0 bg-white py-3.5 pl-12 pr-4 text-gray-900 shadow-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Mobile filter toggle */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
                {selectedCategories.length + (selectedDifficulty ? 1 : 0) + selectedTypes.length}
              </span>
            )}
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-8">
          {/* Filter Sidebar */}
          <aside
            className={cn(
              "w-64 shrink-0",
              showFilters ? "block" : "hidden lg:block"
            )}
          >
            <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Category */}
              <div className="mt-5">
                <h4 className="mb-2 text-sm font-medium text-gray-700">Category</h4>
                <div className="space-y-2">
                  {CATEGORIES.map((cat) => (
                    <label key={cat} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-600">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="mt-5">
                <h4 className="mb-2 text-sm font-medium text-gray-700">Difficulty</h4>
                <div className="space-y-2">
                  {DIFFICULTIES.map((diff) => (
                    <label key={diff} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="difficulty"
                        checked={selectedDifficulty === diff}
                        onChange={() => {
                          setSelectedDifficulty(selectedDifficulty === diff ? "" : diff);
                          setCurrentPage(1);
                        }}
                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-600">{diff}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Course Type */}
              <div className="mt-5">
                <h4 className="mb-2 text-sm font-medium text-gray-700">Course Type</h4>
                <div className="space-y-2">
                  {COURSE_TYPES.map((type) => (
                    <label key={type} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(type)}
                        onChange={() => toggleType(type)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-600">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Sort Bar (Desktop) */}
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium">{filteredCourses.length}</span> courses
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Course Grid */}
            {paginatedCourses.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {paginatedCourses.map((course) => (
                  <a
                    key={course.id}
                    href={`/learn/catalog/${course.slug}`}
                    className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    {/* Thumbnail */}
                    <div
                      className={cn(
                        "flex h-40 items-center justify-center bg-gradient-to-br",
                        course.gradient
                      )}
                    >
                      <BookOpen className="h-12 w-12 text-white/60" />
                    </div>
                    {/* Content */}
                    <div className="p-5">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600">
                        {course.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">
                        {course.description}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        By <span className="font-medium">{course.instructor}</span>
                      </p>
                      {/* Bottom row */}
                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                        <DifficultyBadge difficulty={course.difficulty} />
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(course.duration)}
                        </span>
                        <StarRating rating={course.rating} />
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="h-3.5 w-3.5" />
                          {formatNumber(course.enrolledCount)}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
                <Search className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No courses found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your search or filter criteria.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <X className="h-4 w-4" /> Clear all filters
                </button>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium",
                      page === currentPage
                        ? "bg-indigo-600 text-white"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
