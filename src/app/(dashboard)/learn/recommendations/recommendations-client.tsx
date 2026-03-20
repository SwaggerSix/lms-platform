"use client";

import { useState, useTransition } from "react";
import {
  Star,
  Clock,
  Users,
  Sparkles,
  BookOpen,
  ArrowRight,
  Zap,
  RefreshCw,
  ChevronDown,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDuration } from "@/utils/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RecommendedCourse {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  duration: number;
  rating: number;
  enrolledCount: number;
  gradient: string;
  reason: string;
}

export interface SkillGapItem {
  skill: string;
  gap: number;
  course: RecommendedCourse;
}

export interface AiRecommendation extends RecommendedCourse {
  score: number;
  difficulty_level: string | null;
  category: string | null;
}

export interface AdaptivePathCourse extends RecommendedCourse {
  difficulty_level: string | null;
  order: number;
}

export interface AdaptivePathData {
  skill: string;
  skillId: string;
  currentLevel: number;
  targetLevel: number;
  courses: AdaptivePathCourse[];
}

export interface SimilarCourseBucket {
  completedCourseId: string;
  completedCourseTitle: string;
  completedCourseSlug: string;
  courses: RecommendedCourse[];
}

export interface RecommendationsData {
  skillBased: RecommendedCourse[];
  popular: RecommendedCourse[];
  continueLearning: RecommendedCourse[];
  trending: RecommendedCourse[];
  requiredForRole: RecommendedCourse[];
  skillGaps: SkillGapItem[];
  aiRecommendations: AiRecommendation[];
  adaptivePath: AdaptivePathData | null;
  similarBuckets: SimilarCourseBucket[];
  availableSkills: Array<{ id: string; name: string; currentLevel: number }>;
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function CourseCard({ course }: { course: RecommendedCourse }) {
  return (
    <a
      href={`/learn/catalog/${course.slug}`}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        className={cn(
          "flex h-32 items-center justify-center bg-gradient-to-br",
          course.gradient
        )}
      >
        <BookOpen className="h-10 w-10 text-white/60" />
      </div>
      <div className="p-4">
        {/* Why recommended tag */}
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
          <Sparkles className="h-3 w-3" />
          {course.reason}
        </span>
        <h3 className="mt-2 font-semibold text-gray-900 group-hover:text-indigo-600">
          {course.title}
        </h3>
        <p className="mt-0.5 text-sm text-gray-500">By {course.instructor}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-0.5">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            {course.rating}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(course.duration)}
          </span>
          <span className="flex items-center gap-0.5">
            <Users className="h-3.5 w-3.5" />
            {course.enrolledCount.toLocaleString()}
          </span>
        </div>
      </div>
    </a>
  );
}

function AiCourseCard({ course }: { course: AiRecommendation }) {
  return (
    <a
      href={`/learn/catalog/${course.slug}`}
      className="group relative overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-indigo-300"
    >
      {/* AI badge */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-md">
        <Zap className="h-2.5 w-2.5" />
        AI Pick
      </div>
      <div
        className={cn(
          "flex h-32 items-center justify-center bg-gradient-to-br",
          course.gradient
        )}
      >
        <BookOpen className="h-10 w-10 text-white/60" />
      </div>
      <div className="p-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
          <Sparkles className="h-3 w-3" />
          {course.reason}
        </span>
        <h3 className="mt-2 font-semibold text-gray-900 group-hover:text-indigo-600">
          {course.title}
        </h3>
        <p className="mt-0.5 text-sm text-gray-500">By {course.instructor}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {course.difficulty_level && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 capitalize">
              {course.difficulty_level}
            </span>
          )}
          {course.category && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
              {course.category}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-0.5">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            {course.rating}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(course.duration)}
          </span>
          <span className="flex items-center gap-0.5">
            <Users className="h-3.5 w-3.5" />
            {course.enrolledCount.toLocaleString()}
          </span>
        </div>
      </div>
    </a>
  );
}

function Section({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-5 flex items-center gap-3">
        {icon}
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function DifficultyBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const colors: Record<string, string> = {
    beginner: "bg-green-100 text-green-700",
    intermediate: "bg-yellow-100 text-yellow-700",
    advanced: "bg-orange-100 text-orange-700",
    expert: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
        colors[level.toLowerCase()] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {level}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function RecommendationsClient({
  skillBased,
  popular,
  continueLearning,
  trending,
  requiredForRole,
  skillGaps,
  aiRecommendations,
  adaptivePath: initialAdaptivePath,
  similarBuckets,
  availableSkills,
}: RecommendationsData) {
  const [isRefreshing, startTransition] = useTransition();
  const [selectedSkill, setSelectedSkill] = useState(
    initialAdaptivePath?.skillId ?? availableSkills[0]?.id ?? ""
  );
  const [adaptivePath] = useState(initialAdaptivePath);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);

  const hasAnyRecommendations =
    aiRecommendations.length > 0 ||
    skillBased.length > 0 ||
    popular.length > 0 ||
    continueLearning.length > 0 ||
    trending.length > 0 ||
    requiredForRole.length > 0 ||
    skillGaps.length > 0 ||
    similarBuckets.length > 0;

  function handleRefreshPreferences() {
    startTransition(async () => {
      try {
        await fetch("/api/recommendations", { method: "POST" });
        window.location.reload();
      } catch {
        // Refresh failed silently
      }
    });
  }

  function handleSkillChange(skillId: string) {
    setSelectedSkill(skillId);
    setShowSkillDropdown(false);
    // Navigate with skill param to get new adaptive path
    const url = new URL(window.location.href);
    url.searchParams.set("skill", skillId);
    window.location.href = url.toString();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Recommended for You</h1>
              <p className="mt-1 text-gray-500">
                Personalized course suggestions based on your role, skills, and learning history.
              </p>
            </div>
          </div>
          <button
            onClick={handleRefreshPreferences}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh Recommendations"}
          </button>
        </div>

        {!hasAnyRecommendations && (
          <div className="mt-12 text-center text-gray-500">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-lg font-medium text-gray-700">No recommendations yet</p>
            <p className="mt-1">
              Start enrolling in courses to get personalized suggestions.
            </p>
          </div>
        )}

        <div className="mt-8 space-y-12">
          {/* ============================================================ */}
          {/*  AI-Powered: "Recommended For You"                           */}
          {/* ============================================================ */}
          {aiRecommendations.length > 0 && (
            <Section
              title="Recommended For You"
              icon={
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                  <Zap className="h-4 w-4 text-white" />
                </div>
              }
              badge={
                <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <Sparkles className="h-3 w-3" />
                  Personalized for you
                </span>
              }
            >
              <p className="mb-4 -mt-3 text-sm text-gray-500">
                Curated by analyzing your learning history, skill profile, and what similar learners found valuable.
              </p>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {aiRecommendations.map((course) => (
                  <AiCourseCard key={course.id} course={course} />
                ))}
              </div>
            </Section>
          )}

          {/* ============================================================ */}
          {/*  Adaptive Learning Path                                       */}
          {/* ============================================================ */}
          {adaptivePath && adaptivePath.courses.length > 0 && (
            <Section
              title="Your Personalized Learning Path"
              icon={
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                  <Target className="h-4 w-4 text-white" />
                </div>
              }
              badge={
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Adaptive Path
                </span>
              }
            >
              {/* Skill selector */}
              <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Building: <span className="text-indigo-600">{adaptivePath.skill}</span>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Level {adaptivePath.currentLevel}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-2 w-8 rounded-full",
                            i <= adaptivePath.currentLevel
                              ? "bg-emerald-500"
                              : i <= adaptivePath.targetLevel
                                ? "bg-emerald-200"
                                : "bg-gray-200"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">Level {adaptivePath.targetLevel}</span>
                  </div>
                </div>

                {/* Skill dropdown */}
                {availableSkills.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSkillDropdown(!showSkillDropdown)}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                    >
                      Change skill focus
                      <ChevronDown className={cn("h-4 w-4 transition-transform", showSkillDropdown && "rotate-180")} />
                    </button>
                    {showSkillDropdown && (
                      <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        {availableSkills.map((skill) => (
                          <button
                            key={skill.id}
                            onClick={() => handleSkillChange(skill.id)}
                            className={cn(
                              "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-gray-50",
                              skill.id === selectedSkill && "bg-indigo-50 text-indigo-700"
                            )}
                          >
                            <span>{skill.name}</span>
                            <span className="text-xs text-gray-400">Level {skill.currentLevel}/5</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Path visualization */}
              <div className="relative">
                {/* Connecting line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 to-teal-400 sm:left-8" />

                <div className="space-y-4">
                  {adaptivePath.courses.map((course, index) => (
                    <a
                      key={course.id}
                      href={`/learn/catalog/${course.slug}`}
                      className="group relative flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200 sm:gap-5"
                    >
                      {/* Step number */}
                      <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-md sm:h-16 sm:w-16 sm:text-xl">
                        {course.order}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600">
                            {course.title}
                          </h3>
                          <DifficultyBadge level={course.difficulty_level} />
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500">By {course.instructor}</p>
                        <p className="mt-1 text-xs text-emerald-600 font-medium">{course.reason}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDuration(course.duration)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3.5 w-3.5" />
                            {course.enrolledCount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-indigo-500" />
                    </a>
                  ))}

                  {/* Completion marker */}
                  <div className="relative z-10 flex items-center gap-4 sm:gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-emerald-300 bg-emerald-50 sm:h-16 sm:w-16">
                      <TrendingUp className="h-5 w-5 text-emerald-500 sm:h-6 sm:w-6" />
                    </div>
                    <p className="text-sm font-medium text-emerald-700">
                      Goal: {adaptivePath.skill} mastery (Level {adaptivePath.targetLevel})
                    </p>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* ============================================================ */}
          {/*  "Because You Completed X"                                    */}
          {/* ============================================================ */}
          {similarBuckets.length > 0 &&
            similarBuckets.map((bucket) => (
              <Section
                key={bucket.completedCourseId}
                title={`Because You Completed "${bucket.completedCourseTitle}"`}
                icon={
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
                    <BookOpen className="h-4 w-4 text-white" />
                  </div>
                }
              >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                  {bucket.courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              </Section>
            ))}

          {/* ============================================================ */}
          {/*  Original recommendation sections                             */}
          {/* ============================================================ */}

          {/* Based on Your Skills */}
          {skillBased.length > 0 && (
            <Section title="Based on Your Skills">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {skillBased.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </Section>
          )}

          {/* Skill Gap Recommendations */}
          {skillGaps.length > 0 && (
            <Section title="Skill Gap Recommendations">
              <div className="space-y-4">
                {skillGaps.map((item) => (
                  <div
                    key={item.course.id}
                    className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                          Skill Gap: {item.skill}
                        </span>
                        <span className="text-sm text-gray-500">Gap level: {item.gap} points</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-2 w-6 rounded-full",
                                i <= 5 - item.gap ? "bg-indigo-500" : "bg-gray-200"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">Current</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-2 w-6 rounded-full bg-indigo-500" />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">Required</span>
                      </div>
                    </div>
                    <a
                      href={`/learn/catalog/${item.course.slug}`}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100 md:min-w-[300px]"
                    >
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                          item.course.gradient
                        )}
                      >
                        <BookOpen className="h-5 w-5 text-white/80" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {item.course.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDuration(item.course.duration)} &middot;{" "}
                          {item.course.rating} rating
                        </p>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-gray-400" />
                    </a>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Required for Your Role */}
          {requiredForRole.length > 0 && (
            <Section title="Required for Your Role">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {requiredForRole.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </Section>
          )}

          {/* Continue Learning */}
          {continueLearning.length > 0 && (
            <Section title="Continue Learning">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {continueLearning.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </Section>
          )}

          {/* Popular with Your Peers */}
          {popular.length > 0 && (
            <Section title="Popular with Your Peers">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {popular.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </Section>
          )}

          {/* New & Trending */}
          {trending.length > 0 && (
            <Section title="New &amp; Trending">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {trending.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
