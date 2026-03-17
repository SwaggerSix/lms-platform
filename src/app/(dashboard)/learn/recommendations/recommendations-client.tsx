"use client";

import { Star, Clock, Users, Sparkles, BookOpen, ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDuration } from "@/utils/format";

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

export interface RecommendationsData {
  skillBased: RecommendedCourse[];
  popular: RecommendedCourse[];
  continueLearning: RecommendedCourse[];
  trending: RecommendedCourse[];
  requiredForRole: RecommendedCourse[];
  skillGaps: SkillGapItem[];
}

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="mb-5 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export default function RecommendationsClient({
  skillBased,
  popular,
  continueLearning,
  trending,
  requiredForRole,
  skillGaps,
}: RecommendationsData) {
  const hasAnyRecommendations =
    skillBased.length > 0 ||
    popular.length > 0 ||
    continueLearning.length > 0 ||
    trending.length > 0 ||
    requiredForRole.length > 0 ||
    skillGaps.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
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
