"use client";

import { useState } from "react";
import {
  Trophy,
  Zap,
  Flame,
  Medal,
  Star,
  Target,
  BookOpen,
  Award,
  Lock,
  Users,
  Shield,
  Rocket,
  MessageCircle,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/*  Data Interfaces                                                    */
/* ------------------------------------------------------------------ */

export interface BadgeData {
  id: string;
  name: string;
  description: string;
  iconName: string;
  earned: boolean;
  earnedDate?: string;
  progress?: number;
  maxProgress?: number;
  progressLabel?: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  initials: string;
  level: number;
  levelName: string;
  points: number;
  badges: number;
  isCurrentUser: boolean;
}

export interface ActivityEntry {
  id: string;
  description: string;
  points: number;
  timeAgo: string;
  iconName: string;
}

export interface AchievementsData {
  totalPoints: number;
  currentLevel: number;
  currentLevelName: string;
  currentXP: number;
  nextLevelXP: number;
  streak: number;
  globalRank: number;
  totalUsers: number;
  badges: BadgeData[];
  leaderboard: LeaderboardEntry[];
  activities: ActivityEntry[];
}

/* ------------------------------------------------------------------ */
/*  Icon mapping                                                       */
/* ------------------------------------------------------------------ */

const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  Zap,
  Flame,
  Shield,
  Target,
  Star,
  MessageCircle,
  Trophy,
  Award,
  Users,
  Rocket,
  GraduationCap,
  CheckCircle2,
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LEVEL_NAMES: Record<number, string> = {
  1: "Newcomer",
  2: "Explorer",
  3: "Achiever",
  4: "Scholar",
  5: "Rising Star",
  6: "Expert",
  7: "Master",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type MainTab = "Badges" | "Leaderboard" | "Activity";
type LBFilter = "Global" | "My Department" | "This Month";

export default function AchievementsClient({ data }: { data: AchievementsData }) {
  const [mainTab, setMainTab] = useState<MainTab>("Badges");
  const [lbFilter, setLbFilter] = useState<LBFilter>("Global");

  const {
    totalPoints,
    currentLevel,
    currentLevelName,
    currentXP,
    nextLevelXP,
    streak,
    globalRank,
    totalUsers,
    badges,
    leaderboard,
    activities,
  } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Achievements</h1>
          <p className="mt-1 text-sm text-gray-500">Track your learning milestones and compete with peers.</p>
        </div>

        {/* ---- Stats Row ---- */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Total Points */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                <Zap className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalPoints.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Total Points</p>
              </div>
            </div>
          </div>
          {/* Current Level */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">Level {currentLevel}</p>
                <p className="text-sm text-gray-500">{currentLevelName}</p>
              </div>
            </div>
          </div>
          {/* Streak */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                <Flame className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{streak} days</p>
                <p className="text-sm text-gray-500">Current Streak</p>
              </div>
            </div>
          </div>
          {/* Rank */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                <Medal className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">#{globalRank}</p>
                <p className="text-sm text-gray-500">of {totalUsers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Level Progress ---- */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">
                Level {currentLevel} &ndash; {currentLevelName}
              </h3>
              <p className="text-sm text-gray-500">
                {currentXP}/{nextLevelXP} XP to Level {currentLevel + 1}
              </p>
            </div>
            <span className="text-sm font-medium text-indigo-600">
              {currentXP} / {nextLevelXP} XP
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
              style={{ width: `${(currentXP / nextLevelXP) * 100}%` }}
            />
          </div>
          {/* Level names */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
            {Object.entries(LEVEL_NAMES).map(([lvl, name]) => (
              <span key={lvl} className={cn(Number(lvl) === currentLevel && "font-semibold text-indigo-600")}>
                Lv {lvl}: {name}
              </span>
            ))}
          </div>
        </div>

        {/* ---- Main Tabs ---- */}
        <div className="mt-8 border-b border-gray-200">
          <nav className="flex gap-6">
            {(["Badges", "Leaderboard", "Activity"] as MainTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setMainTab(tab)}
                className={cn(
                  "relative pb-3 text-sm font-medium transition-colors",
                  mainTab === tab ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab}
                {mainTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded" />}
              </button>
            ))}
          </nav>
        </div>

        {/* ======== BADGES TAB ======== */}
        {mainTab === "Badges" && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {badges.map((badge) => {
              const Icon = iconMap[badge.iconName] || Award;
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "rounded-xl border p-5 shadow-sm transition-all",
                    badge.earned
                      ? "border-yellow-300 bg-white ring-1 ring-yellow-200"
                      : "border-gray-200 bg-gray-50 opacity-75"
                  )}
                >
                  {/* Icon circle */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-full",
                        badge.earned
                          ? "bg-gradient-to-br from-yellow-100 to-amber-200 ring-2 ring-yellow-400"
                          : "bg-gray-200"
                      )}
                    >
                      {badge.earned ? (
                        <Icon className="h-7 w-7 text-amber-600" />
                      ) : (
                        <Lock className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <h4 className={cn("mt-3 font-semibold", badge.earned ? "text-gray-900" : "text-gray-500")}>
                      {badge.name}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">{badge.description}</p>

                    {badge.earned ? (
                      <p className="mt-3 text-xs font-medium text-green-600">
                        Awarded {badge.earnedDate}
                      </p>
                    ) : (
                      <div className="mt-3 w-full">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{badge.progressLabel}</span>
                          <span>{badge.progress}/{badge.maxProgress}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-indigo-400 transition-all"
                            style={{ width: `${((badge.progress ?? 0) / (badge.maxProgress ?? 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======== LEADERBOARD TAB ======== */}
        {mainTab === "Leaderboard" && (
          <div className="mt-6">
            {/* Sub-filter tabs */}
            <div className="mb-4 flex gap-2">
              {(["Global", "My Department", "This Month"] as LBFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setLbFilter(f)}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    lbFilter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Rank</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Level</th>
                    <th className="px-6 py-3 text-right">Points</th>
                    <th className="px-6 py-3 text-right">Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaderboard.map((entry) => (
                    <tr
                      key={entry.rank}
                      className={cn(
                        "transition-colors",
                        entry.isCurrentUser ? "bg-indigo-50" : "hover:bg-gray-50"
                      )}
                    >
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                            entry.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                            entry.rank === 2 ? "bg-gray-200 text-gray-600" :
                            entry.rank === 3 ? "bg-amber-100 text-amber-700" :
                            "text-gray-500"
                          )}
                        >
                          {entry.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                              entry.isCurrentUser ? "bg-indigo-200 text-indigo-700" : "bg-gray-200 text-gray-600"
                            )}
                          >
                            {entry.initials}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {entry.name}
                            {entry.isCurrentUser && (
                              <span className="ml-1.5 text-xs text-indigo-600">(You)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Lv.{entry.level} {entry.levelName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                        {entry.points.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">{entry.badges}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======== ACTIVITY TAB ======== */}
        {mainTab === "Activity" && (
          <div className="mt-6">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="divide-y divide-gray-100">
                {activities.map((activity) => {
                  const Icon = iconMap[activity.iconName] || Award;
                  return (
                    <div key={activity.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                        <Icon className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          {activity.description} &rarr;{" "}
                          <span className="font-semibold text-green-600">+{activity.points} points</span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">{activity.timeAgo}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-700">
                        +{activity.points}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
