"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import NominationManager from "@/components/feedback/nomination-manager";
import FeedbackReport from "@/components/feedback/feedback-report";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Competency {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface Cycle {
  id: string;
  name: string;
  description: string | null;
  status: string;
  cycle_type: string;
  start_date: string | null;
  end_date: string | null;
  anonymous: boolean;
  created_at: string;
  creator?: { id: string; first_name: string; last_name: string } | null;
  templates: any[];
  nominations: any[];
}

const STATUS_ACTIONS: Record<string, { next: string; label: string; color: string }> = {
  draft: { next: "active", label: "Activate Cycle", color: "bg-green-600 hover:bg-green-700" },
  active: { next: "closed", label: "Close Cycle", color: "bg-amber-600 hover:bg-amber-700" },
  closed: { next: "archived", label: "Archive Cycle", color: "bg-gray-600 hover:bg-gray-700" },
};

export default function CycleDetailClient({
  cycle: initialCycle,
  users,
  competencies,
}: {
  cycle: Cycle;
  users: User[];
  competencies: Competency[];
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState(initialCycle);
  const [activeTab, setActiveTab] = useState<"nominations" | "template" | "report">("nominations");
  const [updating, setUpdating] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Template state
  const [templateQuestions, setTemplateQuestions] = useState<any[]>(
    cycle.templates?.[0]?.questions || []
  );

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/feedback/cycles/${cycle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCycle({ ...cycle, ...updated });
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNomination = useCallback(async (data: {
    subject_id: string;
    reviewer_id: string;
    relationship: string;
  }) => {
    await fetch(`/api/feedback/cycles/${cycle.id}/nominations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }, [cycle.id]);

  const handleRefreshNominations = useCallback(() => {
    router.refresh();
  }, [router]);

  const loadReport = useCallback(async (subjectId: string) => {
    setLoadingReport(true);
    setSelectedSubject(subjectId);
    try {
      const res = await fetch(`/api/feedback/cycles/${cycle.id}/report?subject_id=${subjectId}`);
      if (res.ok) {
        setReportData(await res.json());
      }
    } finally {
      setLoadingReport(false);
    }
  }, [cycle.id]);

  const addQuestion = () => {
    const newQ = {
      id: crypto.randomUUID(),
      text: "",
      type: "rating" as const,
      required: true,
    };
    setTemplateQuestions([...templateQuestions, newQ]);
  };

  const updateQuestion = (index: number, updates: any) => {
    const updated = [...templateQuestions];
    updated[index] = { ...updated[index], ...updates };
    setTemplateQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setTemplateQuestions(templateQuestions.filter((_, i) => i !== index));
  };

  const statusAction = STATUS_ACTIONS[cycle.status];
  const completedNoms = cycle.nominations?.filter((n: any) => n.status === "completed").length || 0;
  const totalNoms = cycle.nominations?.length || 0;
  const progressPct = totalNoms > 0 ? Math.round((completedNoms / totalNoms) * 100) : 0;

  // Get unique subjects for report
  const subjects = Array.from(
    new Map(
      (cycle.nominations || []).map((n: any) => [
        n.subject?.id,
        n.subject,
      ])
    ).values()
  ).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/admin/feedback")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Cycles
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cycle.name}</h1>
            {cycle.description && (
              <p className="text-gray-500 mt-1">{cycle.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                cycle.status === "active" ? "bg-green-100 text-green-700" :
                cycle.status === "closed" ? "bg-amber-100 text-amber-700" :
                cycle.status === "archived" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-700"
              }`}>
                {cycle.status}
              </span>
              <span className="text-sm text-gray-500">
                {cycle.cycle_type === "360" ? "360-Degree" : cycle.cycle_type} Feedback
              </span>
              {cycle.anonymous && <span className="text-xs text-gray-400">Anonymous</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {statusAction && (
              <button
                onClick={() => updateStatus(statusAction.next)}
                disabled={updating}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${statusAction.color}`}
              >
                {updating ? "Updating..." : statusAction.label}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Completion Progress</span>
            <span className="font-medium text-gray-900">{completedNoms}/{totalNoms} responses ({progressPct}%)</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {([
            { key: "nominations", label: "Nominations", count: totalNoms },
            { key: "template", label: "Template" },
            { key: "report", label: "Reports" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {"count" in tab && tab.count !== undefined && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "nominations" && (
        <NominationManager
          cycleId={cycle.id}
          nominations={cycle.nominations || []}
          availableUsers={users}
          onAddNomination={handleAddNomination}
          onRefresh={handleRefreshNominations}
        />
      )}

      {activeTab === "template" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Feedback Template</h2>
              <p className="text-sm text-gray-500">Configure the questions reviewers will answer</p>
            </div>
            <button
              onClick={addQuestion}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Question
            </button>
          </div>

          {templateQuestions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">No questions configured yet.</p>
              <button
                onClick={addQuestion}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Add your first question
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {templateQuestions.map((q, i) => (
                <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-semibold mt-1">
                      {i + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuestion(i, { text: e.target.value })}
                        placeholder="Enter your question..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex gap-4">
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(i, { type: e.target.value })}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="rating">Rating (1-5)</option>
                          <option value="text">Text Response</option>
                          <option value="competency">Competency Rating</option>
                          <option value="multiple_choice">Multiple Choice</option>
                        </select>
                        {q.type === "competency" && (
                          <select
                            value={q.competency_id || ""}
                            onChange={(e) => updateQuestion(i, { competency_id: e.target.value })}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="">Select competency...</option>
                            {competencies.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                        <label className="flex items-center gap-1.5 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => updateQuestion(i, { required: e.target.checked })}
                            className="w-3.5 h-3.5 text-indigo-600 rounded"
                          />
                          Required
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={() => removeQuestion(i)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "report" && (
        <div className="space-y-6">
          {/* Subject selector */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Subject</label>
            <div className="flex flex-wrap gap-2">
              {subjects.map((sub: any) => (
                <button
                  key={sub.id}
                  onClick={() => loadReport(sub.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedSubject === sub.id
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {sub.first_name} {sub.last_name}
                </button>
              ))}
              {subjects.length === 0 && (
                <p className="text-sm text-gray-500">No subjects with nominations yet.</p>
              )}
            </div>
          </div>

          {/* Report */}
          {loadingReport && (
            <div className="text-center py-12">
              <svg className="w-8 h-8 text-gray-400 animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {reportData && !loadingReport && (
            <FeedbackReport
              cycleName={cycle.name}
              subjectName={
                subjects.find((s: any) => s.id === selectedSubject)
                  ? `${(subjects.find((s: any) => s.id === selectedSubject) as any).first_name} ${(subjects.find((s: any) => s.id === selectedSubject) as any).last_name}`
                  : "Unknown"
              }
              summary={reportData.summary}
              competencyScores={reportData.competency_scores}
              comments={reportData.comments}
              ratingAverages={reportData.rating_averages}
            />
          )}
        </div>
      )}
    </div>
  );
}
