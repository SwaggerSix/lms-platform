"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import ScormUpload from "@/components/course/scorm-upload";

export default function ScormImportClient() {
  const router = useRouter();
  const [title, setTitle] = useState("");

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Courses
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Package className="h-5 w-5 text-primary-600" /> Import a SCORM course
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload the .zip your authoring tool exported (Articulate Storyline/Rise, Adobe Captivate, iSpring, etc.).
          This creates a <strong>draft</strong> course with the package as its lesson. You can preview it, then publish.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Course title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional — defaults to the title in the package's manifest"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>
        <ScormUpload
          bare
          title={title.trim() || undefined}
          onUploaded={(r) => router.push(`/admin/courses/${r.courseSlug}/scorm`)}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-700">Export tips</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Publish to <strong>LMS → SCORM 1.2</strong> (most compatible) or SCORM 2004, not &quot;Web&quot;.</li>
          <li>Set the completion/reporting option you want (e.g. &quot;Passed/Incomplete&quot; for quizzes, &quot;Completed/Incomplete&quot; otherwise).</li>
          <li>Upload the .zip as exported. Don&apos;t unzip and re-zip it.</li>
        </ul>
      </div>
    </div>
  );
}
