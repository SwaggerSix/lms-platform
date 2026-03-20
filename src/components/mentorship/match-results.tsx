"use client";

import { useState, useEffect } from "react";
import MentorCard from "./mentor-card";

interface MentorMatch {
  mentorId: string;
  userId: string;
  name: string;
  expertiseAreas: string[];
  availability: string;
  yearsExperience: number;
  rating: number | null;
  totalReviews: number;
  bio: string | null;
  timezone: string | null;
  preferredMeetingFrequency: string;
  matchScore: number;
  matchReasons: string[];
  currentMenteeCount: number;
  maxMentees: number;
}

interface MatchResultsProps {
  onRequestMentor: (mentorUserId: string) => void;
  isRequesting: boolean;
}

export default function MatchResults({ onRequestMentor, isRequesting }: MatchResultsProps) {
  const [matches, setMatches] = useState<MentorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  async function fetchMatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mentorship/match?limit=6");
      if (!res.ok) throw new Error("Failed to load matches");
      const data = await res.json();
      setMatches(data.matches ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Finding your best mentor matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={fetchMatches}
          className="mt-2 text-sm font-medium text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
        <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p className="mt-3 text-sm text-gray-500">No mentor matches found. Try updating your goals and preferred areas.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">AI-Suggested Matches</h3>
          <p className="text-sm text-gray-500">Based on your skills, goals, and preferences</p>
        </div>
        <button
          onClick={fetchMatches}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((match) => (
          <MentorCard
            key={match.mentorId}
            mentor={{
              id: match.mentorId,
              user_id: match.userId,
              expertise_areas: match.expertiseAreas,
              availability: match.availability,
              max_mentees: match.maxMentees,
              current_mentee_count: match.currentMenteeCount,
              bio: match.bio,
              years_experience: match.yearsExperience,
              timezone: match.timezone,
              preferred_meeting_frequency: match.preferredMeetingFrequency,
              rating: match.rating,
              total_reviews: match.totalReviews,
              user: {
                id: match.userId,
                first_name: match.name.split(" ")[0] || "Unknown",
                last_name: match.name.split(" ").slice(1).join(" ") || "",
                email: "",
              },
            }}
            matchScore={match.matchScore}
            matchReasons={match.matchReasons}
            onRequestMentor={onRequestMentor}
            isRequesting={isRequesting}
          />
        ))}
      </div>
    </div>
  );
}
