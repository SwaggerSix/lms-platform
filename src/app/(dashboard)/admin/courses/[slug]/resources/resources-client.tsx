"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  UploadCloud,
  Loader2,
  Trash2,
  FileText,
  Presentation,
  Video,
  BookOpen,
  GraduationCap,
  Paperclip,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

export interface CourseResource {
  id: string;
  title: string;
  resourceType: string;
  audience: "learner" | "facilitator";
  fileUrl: string;
  fileName: string | null;
  fileType: string | null;
}

const RESOURCE_TYPES: { value: string; label: string; defaultAudience: "learner" | "facilitator" }[] = [
  { value: "presentation_deck", label: "Presentation Deck", defaultAudience: "learner" },
  { value: "video", label: "Video", defaultAudience: "learner" },
  { value: "learner_guide", label: "Learner Guide", defaultAudience: "learner" },
  { value: "course_material", label: "Course Material", defaultAudience: "learner" },
  { value: "facilitator_guide", label: "Facilitator Guide", defaultAudience: "facilitator" },
  { value: "other", label: "Other", defaultAudience: "learner" },
];

const TYPE_META: Record<string, { label: string; icon: typeof FileText }> = {
  presentation_deck: { label: "Presentation Deck", icon: Presentation },
  video: { label: "Video", icon: Video },
  learner_guide: { label: "Learner Guide", icon: BookOpen },
  facilitator_guide: { label: "Facilitator Guide", icon: GraduationCap },
  course_material: { label: "Course Material", icon: Paperclip },
  other: { label: "Other", icon: FileText },
};

export default function CourseResourcesClient({
  courseId,
  courseTitle,
  courseSlug,
  initialResources,
}: {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  initialResources: CourseResource[];
}) {
  const toast = useToast();
  const [resources, setResources] = useState<CourseResource[]>(initialResources);
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState("presentation_deck");
  const [audience, setAudience] = useState<"learner" | "facilitator">("learner");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const onTypeChange = (value: string) => {
    setResourceType(value);
    const def = RESOURCE_TYPES.find((t) => t.value === value)?.defaultAudience ?? "learner";
    setAudience(def);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    setUploading(true);
    try {
      // 1) Upload the file to storage.
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "course-content");
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || "File upload failed");

      // 2) Record the resource against the course.
      const res = await fetch("/api/course-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          title: title.trim() || file.name,
          resource_type: resourceType,
          audience,
          file_url: upData.url,
          file_name: upData.fileName ?? file.name,
          file_type: upData.mimeType ?? file.type,
          file_size: upData.size ?? file.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save resource");

      setResources((prev) => [
        ...prev,
        {
          id: data.id,
          title: data.title,
          resourceType: data.resource_type,
          audience: data.audience,
          fileUrl: data.file_url,
          fileName: data.file_name,
          fileType: data.file_type,
        },
      ]);
      setTitle("");
      setFile(null);
      toast.success("Content added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/course-resources?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete");
      }
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/admin/courses"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to courses
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Course Content</h1>
      <p className="mt-1 text-sm text-gray-500">
        Add presentation decks, videos, learner guides, facilitator guides, and
        other materials for <span className="font-medium">{courseTitle}</span>.
        Learner materials appear on the course page and in learners&apos; Documents;
        facilitator materials are visible only to instructors.
      </p>

      {/* Upload form */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Add content</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select
              value={resourceType}
              onChange={(e) => onTypeChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as "learner" | "facilitator")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="learner">Learners</option>
              <option value="facilitator">Facilitators only</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to the file name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-600 hover:file:bg-primary-100"
          />
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Add content"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Up to 500MB. Supports PDF, PowerPoint, Word, Excel, video, audio, images, and zip.
        </p>
      </div>

      {/* Existing resources */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Content ({resources.length})
        </h2>
        {resources.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            No content added yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {resources.map((r) => {
              const meta = TYPE_META[r.resourceType] ?? TYPE_META.other;
              const Icon = meta.icon;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
                >
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-3"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-primary-500" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-500">
                        {meta.label}
                        {r.audience === "facilitator" ? " · Facilitators only" : ""}
                      </p>
                    </div>
                  </a>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deleting === r.id}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label="Delete resource"
                  >
                    {deleting === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
