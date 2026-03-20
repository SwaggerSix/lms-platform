"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertCircle,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/utils/cn";

// ─── Types ───────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  type: "checkbox" | "rating" | "text" | "yes_no";
  required: boolean;
  weight: number;
}

interface ChecklistFormProps {
  items: ChecklistItem[];
  responses: Record<string, unknown>;
  onChange: (responses: Record<string, unknown>) => void;
  onSave?: (responses: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
  passingScore?: number;
}

// ─── Component ──────────────────────────────────────────────────

export default function ChecklistForm({
  items,
  responses: initialResponses,
  onChange,
  onSave,
  readOnly = false,
  passingScore,
}: ChecklistFormProps) {
  const [responses, setResponses] = useState<Record<string, unknown>>(initialResponses || {});
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    setResponses(initialResponses || {});
  }, [initialResponses]);

  const updateResponse = useCallback((itemId: string, value: unknown) => {
    const updated = { ...responses, [itemId]: value };
    setResponses(updated);
    onChange(updated);
  }, [responses, onChange]);

  const toggleNotes = (itemId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!onSave) return;

    // Check required fields
    const missing = items.filter(
      (item) => item.required && (responses[item.id] === undefined || responses[item.id] === "" || responses[item.id] === null)
    );

    if (missing.length > 0) {
      setShowErrors(true);
      return;
    }

    setSaving(true);
    try {
      await onSave(responses);
      setShowErrors(false);
    } finally {
      setSaving(false);
    }
  };

  // Calculate score
  const calculateScore = useCallback(() => {
    let totalWeight = 0;
    let earnedWeight = 0;

    for (const item of items) {
      const response = responses[item.id];
      if (item.type === "text") continue; // Text items don't count toward score

      totalWeight += item.weight;

      if (item.type === "checkbox") {
        if (response === true) earnedWeight += item.weight;
      } else if (item.type === "yes_no") {
        if (response === "yes") earnedWeight += item.weight;
      } else if (item.type === "rating") {
        const rating = typeof response === "number" ? response : 0;
        earnedWeight += (rating / 5) * item.weight;
      }
    }

    if (totalWeight === 0) return null;
    return Math.round((earnedWeight / totalWeight) * 100 * 100) / 100;
  }, [items, responses]);

  const score = calculateScore();
  const isPassing = score !== null && passingScore !== undefined ? score >= passingScore : null;

  // Count completion
  const answeredCount = items.filter((item) => {
    const r = responses[item.id];
    return r !== undefined && r !== "" && r !== null;
  }).length;

  const isItemMissing = (item: ChecklistItem) =>
    showErrors && item.required && (responses[item.id] === undefined || responses[item.id] === "" || responses[item.id] === null);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              answeredCount === items.length ? "bg-green-500" : "bg-blue-500"
            )}
            style={{ width: `${items.length > 0 ? (answeredCount / items.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-500">
          {answeredCount}/{items.length} completed
        </span>
      </div>

      {/* Checklist items */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border p-4 transition-all",
              isItemMissing(item)
                ? "border-red-300 bg-red-50"
                : responses[item.id] !== undefined && responses[item.id] !== "" && responses[item.id] !== null
                ? "border-green-200 bg-green-50/50"
                : "border-gray-200 bg-white"
            )}
          >
            {/* Item header */}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                {index + 1}
              </span>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  {item.required && (
                    <span className="text-xs text-red-500">*</span>
                  )}
                  {item.weight > 1 && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {item.weight}x weight
                    </span>
                  )}
                </div>

                {/* Response input */}
                <div className="mt-2">
                  {item.type === "checkbox" && (
                    <button
                      onClick={() => !readOnly && updateResponse(item.id, !responses[item.id])}
                      disabled={readOnly}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                        responses[item.id]
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {responses[item.id] ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-300" />
                      )}
                      {responses[item.id] ? "Completed" : "Mark as complete"}
                    </button>
                  )}

                  {item.type === "rating" && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => !readOnly && updateResponse(item.id, star)}
                          disabled={readOnly}
                          className="group p-0.5 transition-transform hover:scale-110"
                        >
                          <Star
                            className={cn(
                              "h-6 w-6 transition-colors",
                              typeof responses[item.id] === "number" && star <= (responses[item.id] as number)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-200 group-hover:text-yellow-300"
                            )}
                          />
                        </button>
                      ))}
                      {typeof responses[item.id] === "number" && (
                        <span className="ml-2 text-sm font-medium text-gray-600">
                          {String(responses[item.id])}/5
                        </span>
                      )}
                    </div>
                  )}

                  {item.type === "text" && (
                    <textarea
                      value={(responses[item.id] as string) || ""}
                      onChange={(e) => updateResponse(item.id, e.target.value)}
                      readOnly={readOnly}
                      placeholder="Enter your observation..."
                      rows={2}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none resize-y"
                    />
                  )}

                  {item.type === "yes_no" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => !readOnly && updateResponse(item.id, "yes")}
                        disabled={readOnly}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                          responses[item.id] === "yes"
                            ? "border-green-300 bg-green-50 text-green-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Yes
                      </button>
                      <button
                        onClick={() => !readOnly && updateResponse(item.id, "no")}
                        disabled={readOnly}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                          responses[item.id] === "no"
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        <ThumbsDown className="h-4 w-4" />
                        No
                      </button>
                    </div>
                  )}
                </div>

                {/* Optional notes toggle */}
                {item.type !== "text" && !readOnly && (
                  <button
                    onClick={() => toggleNotes(item.id)}
                    className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Add note
                    {expandedNotes.has(item.id) ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}

                {expandedNotes.has(item.id) && (
                  <textarea
                    value={(responses[`${item.id}_note`] as string) || ""}
                    onChange={(e) => updateResponse(`${item.id}_note`, e.target.value)}
                    placeholder="Add a note for this item..."
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none resize-y"
                  />
                )}

                {/* Error message */}
                {isItemMissing(item) && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    This item is required
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Score summary */}
      {score !== null && (
        <div className={cn(
          "rounded-lg border p-4",
          isPassing === true && "border-green-200 bg-green-50",
          isPassing === false && "border-red-200 bg-red-50",
          isPassing === null && "border-gray-200 bg-gray-50",
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Current Score</p>
              {passingScore !== undefined && (
                <p className="text-xs text-gray-500">Passing score: {passingScore}%</p>
              )}
            </div>
            <div className={cn(
              "text-2xl font-bold",
              isPassing === true && "text-green-600",
              isPassing === false && "text-red-600",
              isPassing === null && "text-gray-700",
            )}>
              {score}%
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      {onSave && !readOnly && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Responses
          </button>
        </div>
      )}
    </div>
  );
}
