"use client";

import Link from "next/link";
import { BookOpen, Clock, Award, ArrowRight, Layers } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDuration } from "@/utils/format";

export interface LearningPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  courseCount: number;
  totalDuration: number;
  skills: string[];
  progress: number | null;
  enrolled: boolean;
  gradient: string;
}

const GRADIENT_PALETTE = [
  "from-blue-600 to-indigo-700",
  "from-amber-500 to-orange-600",
  "from-green-500 to-emerald-600",
  "from-purple-600 to-violet-700",
  "from-red-500 to-rose-600",
  "from-cyan-500 to-teal-600",
  "from-pink-500 to-fuchsia-600",
  "from-sky-500 to-blue-600",
];

export function pickGradient(index: number): string {
  return GRADIENT_PALETTE[index % GRADIENT_PALETTE.length];
}

interface Props {
  paths: LearningPath[];
}

export default function PathsClient({ paths }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center gap-3">
          <Layers className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Explore Learning Paths</h1>
            <p className="mt-1 text-gray-500">
              Structured programs to guide your professional development from start to finish.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {paths.map((path) => (
            <div
              key={path.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex flex-col md:flex-row">
                {/* Gradient Banner */}
                <div
                  className={cn(
                    "flex w-full items-center justify-center bg-gradient-to-br p-8 md:w-64 md:shrink-0",
                    path.gradient
                  )}
                >
                  <Layers className="h-16 w-16 text-white/50" />
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{path.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{path.description}</p>

                    {/* Stats */}
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" /> {path.courseCount} courses
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" /> {formatDuration(path.totalDuration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-4 w-4" /> Certificate included
                      </span>
                    </div>

                    {/* Skills */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {path.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Progress + Action */}
                  <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                    <div className="flex-1">
                      {path.enrolled && path.progress !== null ? (
                        <div className="max-w-xs">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Progress</span>
                            <span className="font-medium text-gray-900">{path.progress}%</span>
                          </div>
                          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-indigo-600"
                              style={{ width: `${path.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not started</span>
                      )}
                    </div>
                    <Link
                      href={`/learn/paths/${path.slug}`}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
                        path.enrolled
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "border border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                      )}
                    >
                      {path.enrolled ? "Continue" : "Start Path"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
