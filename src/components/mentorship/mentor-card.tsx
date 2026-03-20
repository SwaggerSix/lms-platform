"use client";

import { useState } from "react";

interface MentorCardProps {
  mentor: {
    id: string;
    user_id: string;
    expertise_areas: string[];
    availability: string;
    max_mentees: number;
    current_mentee_count: number;
    bio: string | null;
    years_experience: number | null;
    timezone: string | null;
    preferred_meeting_frequency: string;
    rating: number | null;
    total_reviews: number;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      job_title?: string;
    };
  };
  matchScore?: number;
  matchReasons?: string[];
  onRequestMentor?: (mentorUserId: string) => void;
  isRequesting?: boolean;
}

export default function MentorCard({
  mentor,
  matchScore,
  matchReasons,
  onRequestMentor,
  isRequesting,
}: MentorCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const user = mentor.user;
  const name = `${user.first_name} ${user.last_name}`;
  const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();

  const availabilityColors: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    limited: "bg-yellow-100 text-yellow-700",
    unavailable: "bg-red-100 text-red-700",
  };

  const spotsLeft = mentor.max_mentees - mentor.current_mentee_count;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 truncate">{name}</h3>
            {matchScore !== undefined && (
              <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {Math.round(matchScore)}% match
              </span>
            )}
          </div>

          {user.job_title && (
            <p className="text-sm text-gray-500 truncate">{user.job_title}</p>
          )}

          {/* Rating */}
          <div className="mt-1 flex items-center gap-2">
            {mentor.rating ? (
              <div className="flex items-center gap-1">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= Math.round(parseFloat(String(mentor.rating)))
                          ? "text-yellow-400"
                          : "text-gray-200"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs text-gray-500">
                  {parseFloat(String(mentor.rating)).toFixed(1)} ({mentor.total_reviews})
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">No reviews yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            availabilityColors[mentor.availability] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {mentor.availability}
        </span>
        {mentor.years_experience && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {mentor.years_experience}y exp
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
        </span>
        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600">
          {mentor.preferred_meeting_frequency}
        </span>
      </div>

      {/* Expertise */}
      {mentor.expertise_areas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {mentor.expertise_areas.slice(0, 5).map((area: string, i: number) => (
            <span
              key={i}
              className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 ring-1 ring-inset ring-gray-200"
            >
              {area}
            </span>
          ))}
          {mentor.expertise_areas.length > 5 && (
            <span className="text-xs text-gray-400 self-center">
              +{mentor.expertise_areas.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Match reasons */}
      {matchReasons && matchReasons.length > 0 && (
        <div className="mt-3 space-y-1">
          {matchReasons.slice(0, 3).map((reason, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {reason}
            </div>
          ))}
        </div>
      )}

      {/* Bio toggle */}
      {mentor.bio && (
        <div className="mt-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {showDetails ? "Hide bio" : "Show bio"}
          </button>
          {showDetails && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              {mentor.bio}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      {onRequestMentor && mentor.availability !== "unavailable" && spotsLeft > 0 && (
        <div className="mt-4">
          <button
            onClick={() => onRequestMentor(mentor.user_id)}
            disabled={isRequesting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRequesting ? "Requesting..." : "Request as Mentor"}
          </button>
        </div>
      )}
    </div>
  );
}
