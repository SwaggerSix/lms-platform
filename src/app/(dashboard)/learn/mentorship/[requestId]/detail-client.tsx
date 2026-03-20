"use client";

import { useState } from "react";
import SessionScheduler from "@/components/mentorship/session-scheduler";

interface DetailClientProps {
  request: any;
  sessions: any[];
  reviews: any[];
  userId: string;
  isMentor: boolean;
}

export default function MentorshipDetailClient({
  request,
  sessions: initialSessions,
  reviews,
  userId,
  isMentor,
}: DetailClientProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [status, setStatus] = useState(request.status);
  const [updating, setUpdating] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const mentee = request.mentee as any;
  const mentor = request.mentor as any;
  const partner = isMentor ? mentee : mentor;
  const partnerName = partner
    ? `${partner.first_name} ${partner.last_name}`
    : "Unmatched";

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    matched: "bg-blue-100 text-blue-700 border-blue-200",
    active: "bg-green-100 text-green-700 border-green-200",
    completed: "bg-gray-100 text-gray-600 border-gray-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  const sessionStatusColors: Record<string, string> = {
    scheduled: "bg-blue-50 text-blue-700",
    completed: "bg-green-50 text-green-700",
    cancelled: "bg-gray-50 text-gray-500",
    no_show: "bg-red-50 text-red-700",
  };

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/mentorship/requests/${request.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
      }
    } catch {
      // Silently fail
    } finally {
      setUpdating(false);
    }
  }

  async function handleSessionCreated() {
    setShowScheduler(false);
    // Refresh sessions
    try {
      const res = await fetch(`/api/mentorship/sessions?request_id=${request.id}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // ignore
    }
  }

  async function submitReview() {
    setReviewSubmitting(true);
    try {
      const res = await fetch("/api/mentorship/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: request.id,
          rating: reviewRating,
          review: reviewText || undefined,
        }),
      });
      if (res.ok) {
        setShowReviewForm(false);
        setReviewText("");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit review");
      }
    } catch {
      alert("Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function updateSessionStatus(sessionId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/mentorship/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, status: newStatus } : s))
        );
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <a
        href="/learn/mentorship"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Mentorship
      </a>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
              {partnerName[0] ?? "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{partnerName}</h1>
              <p className="text-sm text-gray-500">
                {partner?.job_title ?? ""} {partner?.email ? `- ${partner.email}` : ""}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                You are the {isMentor ? "Mentor" : "Mentee"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                statusColors[status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Goals */}
        {request.goals && (
          <div className="mt-4 rounded-lg bg-gray-50 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Goals</h3>
            <p className="text-sm text-gray-700">{request.goals}</p>
          </div>
        )}

        {/* Preferred areas */}
        {request.preferred_areas && request.preferred_areas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {request.preferred_areas.map((area: string, i: number) => (
              <span
                key={i}
                className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
              >
                {area}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {status === "matched" && isMentor && (
            <button
              onClick={() => updateStatus("active")}
              disabled={updating}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Accept Mentorship
            </button>
          )}
          {status === "matched" && isMentor && (
            <button
              onClick={() => updateStatus("cancelled")}
              disabled={updating}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Decline
            </button>
          )}
          {status === "active" && (
            <button
              onClick={() => updateStatus("completed")}
              disabled={updating}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Mark Completed
            </button>
          )}
          {["matched", "active"].includes(status) && (
            <button
              onClick={() => setShowScheduler(!showScheduler)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Schedule Session
            </button>
          )}
          {!isMentor && ["active", "completed"].includes(status) && reviews.length === 0 && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Leave Review
            </button>
          )}
        </div>
      </div>

      {/* Session scheduler */}
      {showScheduler && (
        <div className="mb-6">
          <SessionScheduler requestId={request.id} onSessionCreated={handleSessionCreated} />
        </div>
      )}

      {/* Review form */}
      {showReviewForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Leave a Review</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-0.5"
                  >
                    <svg
                      className={`w-6 h-6 ${
                        star <= reviewRating ? "text-yellow-400" : "text-gray-200"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Review (optional)</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowReviewForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={reviewSubmitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {reviewSubmitting ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions */}
      <div className="rounded-xl border border-gray-200 bg-white mb-6">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Sessions ({sessions.length})
          </h2>
        </div>
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No sessions scheduled yet
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {sessions.map((session: any) => (
              <div key={session.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {session.scheduled_at
                          ? new Date(session.scheduled_at).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "Unscheduled"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {session.duration_minutes} min
                        {session.meeting_url && (
                          <>
                            {" - "}
                            <a
                              href={session.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-700"
                            >
                              Join Meeting
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        sessionStatusColors[session.status] ?? "bg-gray-50 text-gray-500"
                      }`}
                    >
                      {session.status}
                    </span>
                    {session.status === "scheduled" && (
                      <button
                        onClick={() => updateSessionStatus(session.id, "completed")}
                        className="text-xs text-green-600 hover:text-green-700 font-medium"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
                {(session.notes || session.mentor_notes || session.mentee_notes) && (
                  <div className="mt-2 ml-12 space-y-1">
                    {session.notes && (
                      <p className="text-xs text-gray-500">Notes: {session.notes}</p>
                    )}
                    {session.mentor_notes && (
                      <p className="text-xs text-gray-500">Mentor: {session.mentor_notes}</p>
                    )}
                    {session.mentee_notes && (
                      <p className="text-xs text-gray-500">Mentee: {session.mentee_notes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Reviews</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {reviews.map((review: any) => {
              const reviewer = review.reviewer as any;
              return (
                <div key={review.id} className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= review.rating ? "text-yellow-400" : "text-gray-200"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      by {reviewer?.first_name} {reviewer?.last_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.review && (
                    <p className="mt-1 text-sm text-gray-600">{review.review}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
