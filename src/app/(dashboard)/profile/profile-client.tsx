"use client";

import { useState } from "react";
import {
  Pencil,
  BookOpen,
  Clock,
  Award,
  Flame,
  MapPin,
  Building,
  Users,
  Calendar,
  CheckCircle2,
  Star,
  Shield,
  Target,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ProfileSkill {
  name: string;
  proficiency: number;
}

export interface ProfileCertification {
  name: string;
  issuer: string;
  issued: string;
  expires: string;
  status: "active" | "expiring";
}

export interface ProfileStats {
  coursesCompleted: number;
  learningHours: number;
  certificates: number;
  dayStreak: number;
}

export interface ProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  jobTitle: string;
  organizationName: string;
  location?: string;
  memberSince: string;
  managerName: string;
  bio: string;
  skills: ProfileSkill[];
  certifications: ProfileCertification[];
  stats: ProfileStats;
}

/* ------------------------------------------------------------------ */
/*  Static Data (badges & activity stay client-side for now)           */
/* ------------------------------------------------------------------ */

const RECENT_ACTIVITY = [
  { id: "ra1", text: "Completed Advanced Python course", timeAgo: "2 hours ago", icon: CheckCircle2 },
  { id: "ra2", text: "Earned Quiz Master badge", timeAgo: "Yesterday", icon: Award },
  { id: "ra3", text: "Scored 95% on Cloud Fundamentals quiz", timeAgo: "2 days ago", icon: Star },
  { id: "ra4", text: "Started Leadership Essentials path", timeAgo: "3 days ago", icon: BookOpen },
  { id: "ra5", text: "Maintained 12-day learning streak", timeAgo: "4 days ago", icon: Flame },
  { id: "ra6", text: "Completed Data Science Basics module", timeAgo: "1 week ago", icon: CheckCircle2 },
];

const TOP_BADGES = [
  { name: "First Steps", icon: BookOpen, color: "bg-blue-100 text-blue-600" },
  { name: "Quick Learner", icon: Target, color: "bg-green-100 text-green-600" },
  { name: "Streak Champ", icon: Flame, color: "bg-orange-100 text-orange-600" },
  { name: "Safety Star", icon: Shield, color: "bg-red-100 text-red-600" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProfileClient({ data }: { data: ProfileData }) {
  const [editMode, setEditMode] = useState(false);
  const [bio, setBio] = useState(data.bio);
  const [saving, setSaving] = useState(false);

  const handleToggleEdit = async () => {
    if (editMode) {
      // Save bio
      setSaving(true);
      try {
        const res = await fetch(`/api/users/${data.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: { bio } }),
        });
        if (!res.ok) throw new Error("Failed to save");
      } catch {
        // Silently fail — bio stays in local state
      } finally {
        setSaving(false);
      }
    }
    setEditMode(!editMode);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---- Profile Header ---- */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-3xl font-bold text-white">
              {data.initials}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900">{data.firstName} {data.lastName}</h1>
              <p className="mt-1 text-gray-600">{data.jobTitle}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500 sm:justify-start">
                <span className="flex items-center gap-1">
                  <Building className="h-4 w-4" />
                  {data.organizationName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Member since {data.memberSince}
                </span>
              </div>
            </div>

            {/* Edit button */}
            <button
              onClick={handleToggleEdit}
              disabled={saving}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
                editMode
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {editMode ? "Save Profile" : "Edit Profile"}
            </button>
          </div>
        </div>

        {/* ---- Two Column Layout ---- */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ===== Left Column (2/3) ===== */}
          <div className="space-y-6 lg:col-span-2">
            {/* About */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">About</h2>
              {editMode ? (
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                />
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{bio}</p>
              )}
            </div>

            {/* Skills */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Skills</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {data.skills.map((skill) => (
                  <div
                    key={skill.name}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-gray-700">{skill.name}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((dot) => (
                        <div
                          key={dot}
                          className={cn(
                            "h-2 w-2 rounded-full",
                            dot <= skill.proficiency ? "bg-indigo-500" : "bg-gray-200"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certifications */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Certifications</h2>
              <div className="mt-4 space-y-3">
                {data.certifications.map((cert) => (
                  <div
                    key={cert.name}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-4",
                      cert.status === "expiring"
                        ? "border-amber-200 bg-amber-50"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{cert.name}</h4>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {cert.issuer} &middot; Issued {cert.issued}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          cert.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {cert.status === "active" ? "Active" : "Expiring Soon"}
                      </span>
                      <p className="mt-1 text-xs text-gray-400">Exp: {cert.expires}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <div className="mt-4">
                {RECENT_ACTIVITY.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="flex gap-3 py-3">
                      {/* Timeline */}
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                          <Icon className="h-4 w-4 text-indigo-600" />
                        </div>
                        {idx < RECENT_ACTIVITY.length - 1 && (
                          <div className="mt-1 h-full w-px bg-gray-200" />
                        )}
                      </div>
                      <div className="pb-1">
                        <p className="text-sm text-gray-900">{item.text}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{item.timeAgo}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===== Right Column (1/3) ===== */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Learning Stats</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-indigo-500" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{data.stats.coursesCompleted}</p>
                  <p className="text-xs text-gray-500">Courses Completed</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{data.stats.learningHours}</p>
                  <p className="text-xs text-gray-500">Learning Hours</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center">
                    <Award className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{data.stats.certificates}</p>
                  <p className="text-xs text-gray-500">Certificates</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{data.stats.dayStreak}</p>
                  <p className="text-xs text-gray-500">Day Streak</p>
                </div>
              </div>
            </div>

            {/* Achievements Showcase */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Top Achievements</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {TOP_BADGES.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <div
                      key={badge.name}
                      className="flex flex-col items-center rounded-lg border border-gray-100 p-3"
                    >
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", badge.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="mt-2 text-xs font-medium text-gray-700">{badge.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team Info */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Team Info</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Manager</p>
                    <p className="text-sm font-medium text-gray-900">{data.managerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p className="text-sm font-medium text-gray-900">{data.organizationName}</p>
                  </div>
                </div>
                {data.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="text-sm font-medium text-gray-900">{data.location}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
