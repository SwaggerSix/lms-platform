"use client";

import { useState, useCallback } from "react";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Nomination {
  id: string;
  subject: User;
  reviewer: User;
  relationship: string;
  status: string;
  responses?: Array<{ id: string; is_draft: boolean; submitted_at: string | null }>;
}

interface NominationManagerProps {
  cycleId: string;
  nominations: Nomination[];
  availableUsers: User[];
  onAddNomination: (data: {
    subject_id: string;
    reviewer_id: string;
    relationship: string;
  }) => Promise<void>;
  onRefresh: () => void;
}

const RELATIONSHIPS = [
  { value: "self", label: "Self Assessment" },
  { value: "peer", label: "Peer" },
  { value: "manager", label: "Manager" },
  { value: "direct_report", label: "Direct Report" },
  { value: "external", label: "External" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};

export default function NominationManager({
  cycleId,
  nominations,
  availableUsers,
  onAddNomination,
  onRefresh,
}: NominationManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [relationship, setRelationship] = useState("peer");
  const [isAdding, setIsAdding] = useState(false);
  const [searchSubject, setSearchSubject] = useState("");
  const [searchReviewer, setSearchReviewer] = useState("");
  const [bulkSubjectId, setBulkSubjectId] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const filteredSubjects = availableUsers.filter(
    (u) =>
      `${u.first_name} ${u.last_name} ${u.email}`
        .toLowerCase()
        .includes(searchSubject.toLowerCase())
  );

  const filteredReviewers = availableUsers.filter(
    (u) =>
      u.id !== subjectId &&
      `${u.first_name} ${u.last_name} ${u.email}`
        .toLowerCase()
        .includes(searchReviewer.toLowerCase())
  );

  const handleAdd = useCallback(async () => {
    if (!subjectId || !reviewerId || !relationship) return;
    setIsAdding(true);
    try {
      await onAddNomination({ subject_id: subjectId, reviewer_id: reviewerId, relationship });
      setSubjectId("");
      setReviewerId("");
      setRelationship("peer");
      setSearchSubject("");
      setSearchReviewer("");
      onRefresh();
    } finally {
      setIsAdding(false);
    }
  }, [subjectId, reviewerId, relationship, onAddNomination, onRefresh]);

  // Group nominations by subject
  const bySubject = nominations.reduce<Record<string, Nomination[]>>((acc, nom) => {
    const key = nom.subject?.id || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(nom);
    return acc;
  }, {});

  const totalComplete = nominations.filter((n) => n.status === "completed").length;
  const totalPending = nominations.filter((n) => n.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{nominations.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Nominations</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalComplete}</p>
          <p className="text-xs text-gray-500 mt-1">Completed</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
          <p className="text-xs text-gray-500 mt-1">Pending</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">
            {Object.keys(bySubject).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Subjects</p>
        </div>
      </div>

      {/* Add Nomination */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <button
          onClick={() => { setShowForm(!showForm); setShowBulk(false); }}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Nomination
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${showForm ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showForm && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject (Who receives feedback)
                </label>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchSubject}
                  onChange={(e) => setSearchSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select subject...</option>
                  {filteredSubjects.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reviewer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reviewer (Who gives feedback)
                </label>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchReviewer}
                  onChange={(e) => setSearchReviewer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select reviewer...</option>
                  {filteredReviewers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-[calc(0.25rem+2px+32px)] focus:ring-2 focus:ring-indigo-500"
                >
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleAdd}
                disabled={!subjectId || !reviewerId || isAdding}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAdding ? "Adding..." : "Add Nomination"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nominations by Subject */}
      <div className="space-y-4">
        {Object.entries(bySubject).map(([subjectIdKey, noms]) => {
          const subject = noms[0]?.subject;
          const completed = noms.filter((n) => n.status === "completed").length;
          return (
            <div key={subjectIdKey} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm">
                    {subject?.first_name?.[0]}
                    {subject?.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {subject?.first_name} {subject?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{subject?.email}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {completed}/{noms.length} completed
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {noms.map((nom) => (
                  <div key={nom.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-700">
                        {nom.reviewer?.first_name} {nom.reviewer?.last_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({nom.reviewer?.email})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 capitalize">
                        {nom.relationship.replace("_", " ")}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_STYLES[nom.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {nom.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {nominations.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-sm font-medium text-gray-900">No nominations yet</h3>
            <p className="text-sm text-gray-500 mt-1">Add reviewers to start collecting feedback.</p>
          </div>
        )}
      </div>
    </div>
  );
}
