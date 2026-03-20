"use client";

import {
  CheckCircle2,
  XCircle,
  Star,
  User,
  Calendar,
  MapPin,
  FileText,
  Award,
  Clock,
  Shield,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@/utils/cn";

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
}

interface ObservationSummaryProps {
  observation: ObservationData;
}

// ─── Component ──────────────────────────────────────────────────

export default function ObservationSummary({ observation }: ObservationSummaryProps) {
  const { template, observer, subject, responses } = observation;
  const items = (template.items || []) as ChecklistItem[];
  const passingScore = template.passing_score;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate score
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

  const score = observation.overall_score ?? calculateScore();
  const isPassing = score !== null && passingScore ? score >= passingScore : null;

  const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
    draft: { color: "text-gray-600", bgColor: "bg-gray-100", label: "Draft" },
    in_progress: { color: "text-blue-600", bgColor: "bg-blue-100", label: "In Progress" },
    completed: { color: "text-green-600", bgColor: "bg-green-100", label: "Completed" },
    signed_off: { color: "text-purple-600", bgColor: "bg-purple-100", label: "Signed Off" },
  };

  const currentStatus = statusConfig[observation.status] || statusConfig.draft;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
            {template.description && (
              <p className="mt-1 text-sm text-gray-500">{template.description}</p>
            )}
            {template.category && (
              <span className="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {template.category}
              </span>
            )}
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", currentStatus.bgColor, currentStatus.color)}>
            {currentStatus.label}
          </span>
        </div>

        {/* Metadata grid */}
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Observer</p>
              <p className="text-sm font-medium text-gray-800">{observer.first_name} {observer.last_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Subject</p>
              <p className="text-sm font-medium text-gray-800">{subject.first_name} {subject.last_name}</p>
            </div>
          </div>
          {observation.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Location</p>
                <p className="text-sm font-medium text-gray-800">{observation.location}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">
                {observation.completed_at ? "Completed" : observation.scheduled_at ? "Scheduled" : "Created"}
              </p>
              <p className="text-sm font-medium text-gray-800">
                {formatDate(observation.completed_at || observation.scheduled_at || observation.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Course link */}
        {observation.course && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <FileText className="h-4 w-4 text-gray-400" />
            Course: <span className="font-medium">{observation.course.title}</span>
          </div>
        )}
      </div>

      {/* Score card */}
      {score !== null && (
        <div className={cn(
          "rounded-xl border p-6 shadow-sm",
          isPassing === true && "border-green-200 bg-gradient-to-br from-green-50 to-emerald-50",
          isPassing === false && "border-red-200 bg-gradient-to-br from-red-50 to-rose-50",
          isPassing === null && "border-gray-200 bg-white",
        )}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Award className={cn("h-5 w-5", isPassing ? "text-green-500" : "text-red-500")} />
                <h3 className="text-sm font-semibold text-gray-700">Overall Score</h3>
              </div>
              {passingScore && (
                <p className="mt-1 text-xs text-gray-500">
                  Passing: {passingScore}% &middot; {isPassing ? "PASSED" : "NOT PASSED"}
                </p>
              )}
            </div>
            <div className={cn(
              "text-4xl font-bold",
              isPassing === true && "text-green-600",
              isPassing === false && "text-red-600",
              isPassing === null && "text-gray-700",
            )}>
              {score}%
            </div>
          </div>
        </div>
      )}

      {/* Checklist responses */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Checklist Responses</h3>
          <p className="text-xs text-gray-500">{items.length} items</p>
        </div>

        <div className="divide-y divide-gray-100">
          {items.map((item, index) => {
            const response = responses[item.id];
            const note = responses[`${item.id}_note`] as string | undefined;

            return (
              <div key={item.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                    {index + 1}
                  </span>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>

                    {/* Response display */}
                    <div className="mt-1.5">
                      {item.type === "checkbox" && (
                        <div className="flex items-center gap-1.5">
                          {response === true ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-700">Completed</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-gray-300" />
                              <span className="text-sm text-gray-500">Not completed</span>
                            </>
                          )}
                        </div>
                      )}

                      {item.type === "rating" && (
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={cn(
                                "h-4 w-4",
                                typeof response === "number" && star <= response
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-200"
                              )}
                            />
                          ))}
                          <span className="ml-1.5 text-sm text-gray-600">
                            {typeof response === "number" ? `${response}/5` : "Not rated"}
                          </span>
                        </div>
                      )}

                      {item.type === "text" && (
                        <p className={cn(
                          "text-sm",
                          response ? "text-gray-700" : "text-gray-400 italic"
                        )}>
                          {(response as string) || "No response provided"}
                        </p>
                      )}

                      {item.type === "yes_no" && (
                        <div className="flex items-center gap-1.5">
                          {response === "yes" ? (
                            <>
                              <ThumbsUp className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-700">Yes</span>
                            </>
                          ) : response === "no" ? (
                            <>
                              <ThumbsDown className="h-4 w-4 text-red-500" />
                              <span className="text-sm text-red-700">No</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Not answered</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Note */}
                    {note && (
                      <div className="mt-2 rounded-md bg-gray-50 border border-gray-100 px-3 py-2">
                        <p className="text-xs text-gray-500 font-medium">Note</p>
                        <p className="text-xs text-gray-600">{note}</p>
                      </div>
                    )}
                  </div>

                  {/* Weight badge */}
                  {item.weight > 1 && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {item.weight}x
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      {observation.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{observation.notes}</p>
        </div>
      )}

      {/* Sign-off details */}
      {observation.status === "signed_off" && observation.sign_off_user && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-500" />
            <h3 className="text-sm font-semibold text-purple-900">Signed Off</h3>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-purple-700">
            <span>
              By: {observation.sign_off_user.first_name} {observation.sign_off_user.last_name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(observation.signed_off_at)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
