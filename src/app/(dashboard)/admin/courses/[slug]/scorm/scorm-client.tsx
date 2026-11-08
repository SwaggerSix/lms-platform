"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Package,
  Plus,
  Rocket,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import ScormUpload from "@/components/course/scorm-upload";

export interface ScormLessonRow {
  id: string;
  title: string;
  moduleTitle: string;
  contentUrl: string | null;
  version: string | null;
  fileName: string | null;
  fileCount: number | null;
  uploadedAt: string | null;
}

interface Props {
  course: { id: string; title: string; slug: string; status: string };
  lessons: ScormLessonRow[];
  totalLessons: number;
  currentVersion: number | null;
  canEdit: boolean;
}

const statusBadge: Record<string, string> = {
  published: "bg-green-50 text-green-700 ring-green-600/20",
  draft: "bg-amber-50 text-amber-700 ring-amber-600/20",
  archived: "bg-gray-100 text-gray-500 ring-gray-500/20",
};

export default function ScormManageClient({ course, lessons, totalLessons, currentVersion, canEdit }: Props) {
  const router = useRouter();
  const [changedSincePublish, setChangedSincePublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [showAdd, setShowAdd] = useState(lessons.length === 0);

  const isPublished = course.status === "published";
  const previewHref = `/learn/player/${course.id}`;

  const onUploaded = () => {
    if (isPublished) setChangedSincePublish(true);
    router.refresh();
  };

  const publish = async () => {
    setPublishing(true);
    setMessage(null);
    try {
      const res = isPublished
        ? await fetch(`/api/courses/${course.slug}/versions`, { method: "POST" })
        : await fetch("/api/courses", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: course.id, status: "published" }),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Publish failed");
      }
      setChangedSincePublish(false);
      setMessage({
        kind: "ok",
        text: isPublished
          ? "New version published. New enrollments get the updated package; learners already in progress keep the version they started."
          : "Course published. Assign it or let learners enroll from the catalog.",
      });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Publish failed" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Courses
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{course.title}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${statusBadge[course.status] ?? statusBadge.draft}`}
              >
                {course.status}
              </span>
              {isPublished && currentVersion !== null && <span>Live version: v{currentVersion}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" /> Preview as learner
            </a>
            {canEdit && course.status !== "archived" && (
              <button
                onClick={publish}
                disabled={publishing || lessons.length === 0 || (isPublished && !changedSincePublish)}
                title={isPublished && !changedSincePublish ? "No package changes since the last publish" : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {isPublished ? "Publish new version" : "Publish course"}
              </button>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.kind === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          {message.text}
        </div>
      )}

      {changedSincePublish && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          This course is live. Learners keep the version they enrolled in, so the new package reaches new enrollments
          only after you click <strong>Publish new version</strong>. Preview it first.
        </div>
      )}

      {!canEdit && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Only an admin or the course&apos;s creator can change its SCORM packages.
        </div>
      )}

      <section className="space-y-4">
        {lessons.map((l) => (
          <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Package className="h-4 w-4 text-primary-600" />
                  {l.title}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {l.moduleTitle}
                  {l.version && ` · SCORM ${l.version}`}
                  {l.fileName && ` · ${l.fileName}`}
                  {l.uploadedAt && ` · uploaded ${new Date(l.uploadedAt).toLocaleString()}`}
                </p>
              </div>
            </div>
            {canEdit && (
              <ScormUpload
                bare
                lessonId={l.id}
                initialUrl={l.contentUrl}
                onUploaded={onUploaded}
              />
            )}
          </div>
        ))}

        {canEdit &&
          (showAdd ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-1 text-sm font-semibold text-gray-900">
                {lessons.length === 0 ? "Add a SCORM package" : "Add another SCORM package"}
              </h2>
              <p className="mb-3 text-xs text-gray-500">
                Adds a new lesson at the end of the course
                {totalLessons > 0 ? ` (currently ${totalLessons} lesson${totalLessons === 1 ? "" : "s"})` : ""}.
              </p>
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="Lesson title (optional — defaults to the package's title)"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <ScormUpload
                bare
                courseId={course.id}
                title={newLessonTitle || undefined}
                onUploaded={() => {
                  setNewLessonTitle("");
                  setShowAdd(false);
                  onUploaded();
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <Plus className="h-4 w-4" /> Add another SCORM package to this course
            </button>
          ))}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <ListChecks className="h-4 w-4 text-primary-600" /> Before you publish
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>
            Click <strong>Preview as learner</strong> and play through to the end. Preview never records progress.
          </li>
          <li>
            For a real tracking test, enroll a test account, take the course, close it midway and reopen it. It
            should resume where you left off. Then finish it and check the lesson shows as complete with a score.
          </li>
          <li>
            Publish. For updates to a live course, upload the new .zip above, preview, then <strong>Publish new version</strong>.
          </li>
        </ol>
      </section>
    </div>
  );
}
