"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Save,
  Loader2,
  AlertCircle,
  Eye,
  Edit,
} from "lucide-react";
import { cn } from "@/utils/cn";
import ChecklistBuilder, { type ChecklistItem } from "@/components/observations/checklist-builder";
import ChecklistForm from "@/components/observations/checklist-form";
import Link from "next/link";

// ─── Component ──────────────────────────────────────────────────

export default function NewTemplateClient() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [passingScore, setPassingScore] = useState<string>("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewResponses, setPreviewResponses] = useState<Record<string, unknown>>({});

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    if (items.length === 0) {
      setError("Add at least one checklist item");
      return;
    }

    const emptyItems = items.filter((i) => !i.label.trim());
    if (emptyItems.length > 0) {
      setError("All checklist items must have a label");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/observations/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          passing_score: passingScore ? parseFloat(passingScore) : undefined,
          items,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create template");
      }

      router.push("/admin/observations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/observations"
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Observation Template</h1>
            <p className="text-sm text-gray-500">Design a checklist for workplace observations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => setMode("edit")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "edit" ? "bg-gray-100 text-gray-800" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Edit className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              onClick={() => setMode("preview")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "preview" ? "bg-gray-100 text-gray-800" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Template
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {mode === "edit" ? (
        <>
          {/* Template metadata */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Template Details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Safety Observation Checklist"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe when and how this checklist should be used..."
                  rows={3}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Safety, Compliance, Skills"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Passing Score (%)</label>
                <input
                  type="number"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                  placeholder="e.g., 80"
                  min={0}
                  max={100}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Checklist items builder */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Checklist Items</h2>
            <ChecklistBuilder items={items} onChange={setItems} />
          </div>
        </>
      ) : (
        /* Preview mode */
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
            This is a preview of how the checklist will appear to observers. Responses are not saved.
          </div>
          {items.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{name || "Untitled Template"}</h2>
              {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
              <ChecklistForm
                items={items}
                responses={previewResponses}
                onChange={setPreviewResponses}
                passingScore={passingScore ? parseFloat(passingScore) : undefined}
              />
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              Add checklist items in Edit mode to see a preview
            </p>
          )}
        </div>
      )}
    </div>
  );
}
