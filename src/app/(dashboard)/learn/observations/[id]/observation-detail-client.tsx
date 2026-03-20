"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Play,
  CheckCircle2,
  Shield,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/utils/cn";
import ChecklistForm from "@/components/observations/checklist-form";
import ObservationSummary from "@/components/observations/observation-summary";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  type: "checkbox" | "rating" | "text" | "yes_no";
  required: boolean;
  weight: number;
}

interface ObservationData {
  id: string;
  status: string;
  overall_score: number | null;
  responses: Record<string, unknown>;
  notes: string | null;
  location: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  signed_off_at: string | null;
  observer_id: string;
  subject_id: string;
  created_at: string;
  template: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    items: ChecklistItem[];
    passing_score?: number;
  };
  observer: { id: string; first_name: string; last_name: string; email?: string };
  subject: { id: string; first_name: string; last_name: string; email?: string };
  course?: { id: string; title: string } | null;
  sign_off_user?: { id: string; first_name: string; last_name: string } | null;
  attachments?: Array<{ id: string; file_url: string; file_name: string; file_type: string; created_at: string }>;
}

interface Props {
  observation: ObservationData;
  currentUserId: string;
  currentUserRole: string;
  isObserver: boolean;
  isSubject: boolean;
}

// ─── Component ──────────────────────────────────────────────────

export default function ObservationDetailClient({
  observation: initialObservation,
  currentUserId,
  currentUserRole,
  isObserver,
  isSubject,
}: Props) {
  const router = useRouter();
  const [observation, setObservation] = useState(initialObservation);
  const [responses, setResponses] = useState<Record<string, unknown>>(initialObservation.responses || {});
  const [notes, setNotes] = useState(initialObservation.notes || "");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [signOffNotes, setSignOffNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSignOff, setShowSignOff] = useState(false);

  const items = (observation.template?.items || []) as ChecklistItem[];
  const isEditable = isObserver && (observation.status === "draft" || observation.status === "in_progress");
  const canSignOff = (currentUserRole === "admin" || currentUserRole === "manager") && observation.status === "completed" && !isObserver;
  const isCompleted = observation.status === "completed" || observation.status === "signed_off";

  const calculateScore = () => {
    let totalWeight = 0;
    let earnedWeight = 0;
    for (const item of items) {
      if (item.type === "text") continue;
      totalWeight += item.weight;
      const response = responses[item.id];
      if (item.type === "checkbox" && response === true) earnedWeight += item.weight;
      if (item.type === "yes_no" && response === "yes") earnedWeight += item.weight;
      if (item.type === "rating" && typeof response === "number") {
        earnedWeight += (response / 5) * item.weight;
      }
    }
    if (totalWeight === 0) return null;
    return Math.round((earnedWeight / totalWeight) * 100 * 100) / 100;
  };

  const handleSave = async (newResponses: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/observations/${observation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: newResponses,
          notes: notes || undefined,
          status: observation.status === "draft" ? "in_progress" : observation.status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await res.json();
      setObservation((prev) => ({ ...prev, ...data.observation, template: prev.template, observer: prev.observer, subject: prev.subject }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm("Mark this observation as completed? You won't be able to edit responses afterward.")) return;

    setCompleting(true);
    setError(null);
    try {
      const score = calculateScore();
      const res = await fetch(`/api/observations/${observation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          responses,
          notes: notes || undefined,
          overall_score: score,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete");
      }

      const data = await res.json();
      setObservation((prev) => ({ ...prev, ...data.observation, template: prev.template, observer: prev.observer, subject: prev.subject }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete");
    } finally {
      setCompleting(false);
    }
  };

  const handleSignOff = async () => {
    setSigningOff(true);
    setError(null);
    try {
      const res = await fetch(`/api/observations/${observation.id}/sign-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: signOffNotes || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to sign off");
      }

      const data = await res.json();
      setObservation((prev) => ({ ...prev, ...data.observation, template: prev.template }));
      setShowSignOff(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign off");
    } finally {
      setSigningOff(false);
    }
  };

  const handleStartObservation = async () => {
    try {
      const res = await fetch(`/api/observations/${observation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (res.ok) {
        const data = await res.json();
        setObservation((prev) => ({ ...prev, ...data.observation, template: prev.template, observer: prev.observer, subject: prev.subject }));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/learn/observations"
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{observation.template?.name || "Observation"}</h1>
            <p className="text-sm text-gray-500">
              {isObserver ? `Observing ${observation.subject?.first_name} ${observation.subject?.last_name}` : `Observed by ${observation.observer?.first_name} ${observation.observer?.last_name}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Start button for draft */}
          {isObserver && observation.status === "draft" && (
            <button
              onClick={handleStartObservation}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              Start Observation
            </button>
          )}

          {/* Complete button */}
          {isEditable && observation.status === "in_progress" && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Complete
            </button>
          )}

          {/* Sign-off button */}
          {canSignOff && (
            <button
              onClick={() => setShowSignOff(true)}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <Shield className="h-4 w-4" />
              Sign Off
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Sign-off form */}
      {showSignOff && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-purple-900">Sign Off Observation</h3>
          <p className="text-xs text-purple-700">
            By signing off, you confirm this observation has been reviewed and is accurate.
          </p>
          <textarea
            value={signOffNotes}
            onChange={(e) => setSignOffNotes(e.target.value)}
            placeholder="Add sign-off notes (optional)..."
            rows={3}
            className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOff}
              disabled={signingOff}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {signingOff ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Confirm Sign Off
            </button>
            <button
              onClick={() => setShowSignOff(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main content: editable form or summary */}
      {isEditable ? (
        <div className="space-y-4">
          {/* Notes field */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Observer Notes</h3>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add general observation notes..."
              rows={3}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none resize-y"
            />
          </div>

          {/* Checklist form */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Checklist</h3>
            <ChecklistForm
              items={items}
              responses={responses}
              onChange={setResponses}
              onSave={handleSave}
              passingScore={observation.template?.passing_score}
            />
          </div>
        </div>
      ) : (
        <ObservationSummary observation={observation as any} />
      )}
    </div>
  );
}
