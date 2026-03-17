"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  ChevronRight,
  X,
  Target,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/utils/cn";

export interface TeamMemberSkills {
  id: string;
  name: string;
  avatar: string;
  role: string;
  skills: Record<string, number>; // 1-5
}

export interface SkillsClientProps {
  teamSkills: TeamMemberSkills[];
  skillNames: string[];
}

const targetLevels: Record<string, number> = {
  React: 3,
  TypeScript: 3,
  Python: 3,
  "Cloud/AWS": 3,
  "Data Analysis": 3,
  Leadership: 3,
};

const proficiencyLabels = ["", "Beginner", "Basic", "Intermediate", "Advanced", "Expert"];

function getProficiencyColor(level: number): string {
  switch (level) {
    case 1:
      return "bg-red-400 text-white";
    case 2:
      return "bg-orange-400 text-white";
    case 3:
      return "bg-yellow-400 text-gray-900";
    case 4:
      return "bg-lime-500 text-white";
    case 5:
      return "bg-green-600 text-white";
    default:
      return "bg-gray-200 text-gray-500";
  }
}

function getProficiencyBg(level: number): string {
  switch (level) {
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-orange-500";
    case 3:
      return "bg-yellow-500";
    case 4:
      return "bg-lime-500";
    case 5:
      return "bg-green-600";
    default:
      return "bg-gray-300";
  }
}

const recommendedCourses: Record<string, string[]> = {
  React: ["Advanced React Patterns", "React Performance Optimization"],
  TypeScript: ["TypeScript Masterclass", "Advanced TypeScript Generics"],
  Python: ["Python for Data Science", "Advanced Python Programming"],
  "Cloud/AWS": ["AWS Solutions Architect", "Cloud Architecture Fundamentals"],
  "Data Analysis": ["Data Visualization with D3", "Statistical Analysis Fundamentals"],
  Leadership: ["Leadership Essentials", "Team Management Strategies"],
};

export default function SkillsClient({ teamSkills, skillNames }: SkillsClientProps) {
  const router = useRouter();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [coursesModalSkill, setCoursesModalSkill] = useState<string | null>(null);

  // Calculate averages per skill
  const skillAverages: Record<string, number> = {};
  skillNames.forEach((skill) => {
    const total = teamSkills.reduce((sum, m) => sum + (m.skills[skill] || 0), 0);
    skillAverages[skill] = parseFloat((total / teamSkills.length).toFixed(1));
  });

  // Calculate distribution per skill
  const skillDistribution: Record<string, number[]> = {};
  skillNames.forEach((skill) => {
    const dist = [0, 0, 0, 0, 0]; // levels 1-5
    teamSkills.forEach((m) => {
      const level = m.skills[skill];
      if (level >= 1 && level <= 5) {
        dist[level - 1]++;
      }
    });
    skillDistribution[skill] = dist;
  });

  // Gap analysis
  const gapSkills = skillNames.filter(
    (skill) => skillAverages[skill] < (targetLevels[skill] ?? 3)
  );

  const selectedMemberData = selectedMember
    ? teamSkills.find((m) => m.id === selectedMember)
    : null;

  const handleCourseClick = (course: string, skill: string) => {
    const query = encodeURIComponent(skill);
    router.push(`/learn/catalog?skill=${query}&search=${encodeURIComponent(course)}`);
  };

  const handleViewAllCourses = (skill: string) => {
    const query = encodeURIComponent(skill);
    router.push(`/learn/catalog?skill=${query}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Sparkles className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Team Skills Overview
          </h1>
        </div>
        <p className="text-gray-500 mt-1">
          Visualize team proficiency levels and identify skill gaps
        </p>
      </div>

      {/* Skills Heat Map */}
      <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Skills Heat Map
          </h2>
          <p className="text-sm text-gray-500">
            Click on a team member to see their detailed skill breakdown
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Team Member
                </th>
                {skillNames.map((skill) => (
                  <th
                    key={skill}
                    className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500"
                  >
                    {skill}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teamSkills.map((member) => (
                <tr
                  key={member.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-gray-50",
                    selectedMember === member.id && "bg-indigo-50"
                  )}
                  onClick={() =>
                    setSelectedMember(
                      selectedMember === member.id ? null : member.id
                    )
                  }
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {member.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {member.name}
                        </p>
                        <p className="text-xs text-gray-500">{member.role}</p>
                      </div>
                    </div>
                  </td>
                  {skillNames.map((skill) => {
                    const level = member.skills[skill] || 0;
                    return (
                      <td key={skill} className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold",
                            getProficiencyColor(level)
                          )}
                          title={`${proficiencyLabels[level] || "None"} (${level}/5)`}
                        >
                          {level}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Averages Row */}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="px-6 py-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Team Average
                  </p>
                </td>
                {skillNames.map((skill) => (
                  <td
                    key={skill}
                    className="px-4 py-3 text-center"
                  >
                    <span
                      className={cn(
                        "text-sm font-bold",
                        skillAverages[skill] >= (targetLevels[skill] ?? 3)
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {skillAverages[skill]}
                    </span>
                    <span className="text-xs text-gray-500">
                      /{targetLevels[skill] ?? 3}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 border-t border-gray-200 px-6 py-3">
          {[1, 2, 3, 4, 5].map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
                  getProficiencyColor(level)
                )}
              >
                {level}
              </span>
              <span className="text-xs text-gray-500">
                {proficiencyLabels[level]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Member Drill-Down Panel */}
      {selectedMemberData && (
        <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {selectedMemberData.avatar}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedMemberData.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedMemberData.role}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedMember(null)}
              className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-600"
              aria-label="Close member details"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {skillNames.map((skill) => {
              const level = selectedMemberData.skills[skill] || 0;
              const target = targetLevels[skill] ?? 3;
              const meetsTarget = level >= target;
              return (
                <div
                  key={skill}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    {skill}
                  </p>
                  <div className="mb-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">
                      {level}
                    </span>
                    <span className="text-sm text-gray-500">/5</span>
                  </div>
                  <p className="mb-2 text-xs text-gray-500">
                    {proficiencyLabels[level] || "None"}
                  </p>
                  <div className="mb-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          i <= level
                            ? getProficiencyBg(level)
                            : "bg-gray-200"
                        )}
                      />
                    ))}
                  </div>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      meetsTarget ? "text-green-600" : "text-red-500"
                    )}
                  >
                    {meetsTarget
                      ? "Meets target"
                      : `${target - level} level(s) below target`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skill Distribution */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skillNames.map((skill) => {
          const dist = skillDistribution[skill];
          const maxCount = Math.max(...dist);
          return (
            <div
              key={skill}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{skill}</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    skillAverages[skill] >= (targetLevels[skill] ?? 3)
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  Avg: {skillAverages[skill]}
                </span>
              </div>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((level) => {
                  const count = dist[level - 1];
                  const pct = maxCount > 0 ? (count / teamSkills.length) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-2">
                      <span className="w-6 text-right text-xs font-medium text-gray-500">
                        L{level}
                      </span>
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            getProficiencyBg(level)
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-xs text-gray-500">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gap Analysis */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Gap Analysis
            </h2>
          </div>
          <p className="text-sm text-gray-500">
            Skills where team average is below the target level of 3.0
          </p>
        </div>
        {gapSkills.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            All skills are at or above target levels. Great work!
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {gapSkills.map((skill) => {
              const gap = (targetLevels[skill] ?? 3) - skillAverages[skill];
              const membersBelow = teamSkills.filter(
                (m) => (m.skills[skill] || 0) < (targetLevels[skill] ?? 3)
              );
              return (
                <div key={skill} className="px-6 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-gray-900">
                        {skill}
                      </span>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Gap: {gap.toFixed(1)} levels
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {membersBelow.length} member(s) below target
                      </span>
                      <button
                        onClick={() => handleViewAllCourses(skill)}
                        className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Browse Catalog
                      </button>
                    </div>
                  </div>
                  <div className="ml-7 mb-2 flex flex-wrap gap-2">
                    {membersBelow.map((m) => (
                      <span
                        key={m.id}
                        className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
                      >
                        <span className="font-medium">{m.name}</span>
                        <span className="text-gray-500">
                          (Level {m.skills[skill] || 0})
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="ml-7">
                    <p className="mb-1 text-xs font-medium text-gray-500">
                      Recommended Courses:
                    </p>
                    <div className="flex gap-2">
                      {(recommendedCourses[skill] || []).map((course) => (
                        <button
                          key={course}
                          onClick={() => handleCourseClick(course, skill)}
                          className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                        >
                          <BookOpen className="h-3 w-3" />
                          {course}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommended Courses Modal */}
      {coursesModalSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label={`Recommended Courses: ${coursesModalSkill}`} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Recommended Courses: {coursesModalSkill}
              </h2>
              <button
                onClick={() => setCoursesModalSkill(null)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close recommended courses"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {(recommendedCourses[coursesModalSkill] || []).map((course) => (
                <button
                  key={course}
                  onClick={() => {
                    setCoursesModalSkill(null);
                    handleCourseClick(course, coursesModalSkill);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-indigo-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {course}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
              <button
                onClick={() => {
                  setCoursesModalSkill(null);
                  handleViewAllCourses(coursesModalSkill);
                }}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                Browse All {coursesModalSkill} Courses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
