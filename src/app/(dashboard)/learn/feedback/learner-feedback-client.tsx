"use client";

import { useState } from "react";
import Link from "next/link";

interface PendingReview {
  id: string;
  relationship: string;
  status: string;
  cycle: { id: string; name: string; status: string; anonymous: boolean; end_date: string | null };
  subject: { id: string; first_name: string; last_name: string };
  responses: Array<{ id: string; is_draft: boolean; submitted_at: string | null }>;
}

interface MyCycleEntry {
  cycle: { id: string; name: string; status: string; cycle_type: string };
  total: number;
  completed: number;
}

interface LearnerFeedbackClientProps {
  userId: string;
  userName: string;
  pendingReviews: PendingReview[];
  myCycles: MyCycleEntry[];
}

export default function LearnerFeedbackClient({
  userId,
  userName,
  pendingReviews,
  myCycles,
}: LearnerFeedbackClientProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "reports">("pending");

  const relationshipLabels: Record<string, string> = {
    self: "Self Assessment",
    peer: "Peer Review",
    manager: "Manager Review",
    direct_report: "Direct Report Review",
    external: "External Review",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Feedback</h1>
        <p className="text-gray-500 mt-1">Complete pending reviews and view feedback reports about you</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingReviews.length}</p>
              <p className="text-xs text-gray-500">Pending Reviews</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {pendingReviews.filter((r) => r.responses?.some((resp) => !resp.is_draft)).length}
              </p>
              <p className="text-xs text-gray-500">Completed Reviews</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{myCycles.length}</p>
              <p className="text-xs text-gray-500">My Reports</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("pending")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "pending"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Pending Reviews
            {pendingReviews.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                {pendingReviews.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "reports"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            My Feedback Reports
          </button>
        </div>
      </div>

      {/* Pending Reviews */}
      {activeTab === "pending" && (
        <div className="space-y-3">
          {pendingReviews.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
              <p className="text-gray-500 mt-1">You have no pending feedback reviews.</p>
            </div>
          ) : (
            pendingReviews.map((review) => {
              const hasDraft = review.responses?.some((r) => r.is_draft);
              return (
                <Link
                  key={review.id}
                  href={`/learn/feedback/${review.id}`}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm">
                      {review.subject.first_name[0]}{review.subject.last_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {review.cycle.anonymous
                          ? "Feedback Review"
                          : `Review for ${review.subject.first_name} ${review.subject.last_name}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{review.cycle.name}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-xs text-gray-500">
                          {relationshipLabels[review.relationship] || review.relationship}
                        </span>
                        {review.cycle.end_date && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="text-xs text-gray-500">
                              Due {new Date(review.cycle.end_date).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasDraft && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        Draft Saved
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      review.status === "in_progress"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {review.status === "in_progress" ? "Continue" : "Start"}
                    </span>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* My Reports */}
      {activeTab === "reports" && (
        <div className="space-y-3">
          {myCycles.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">No feedback reports yet</h3>
              <p className="text-gray-500 mt-1">Reports will appear here when feedback cycles you&apos;re part of are completed.</p>
            </div>
          ) : (
            myCycles.map((entry) => {
              const pct = entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0;
              return (
                <div
                  key={entry.cycle.id}
                  className="p-5 bg-white border border-gray-200 rounded-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{entry.cycle.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {entry.cycle.cycle_type === "360" ? "360-Degree" : entry.cycle.cycle_type} Feedback
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                          {entry.cycle.status}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {entry.completed}/{entry.total} responses
                      </p>
                      <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
