"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

export interface AssessmentEmbedData {
  id: string;
  title: string;
  description: string;
  course_title: string;
}

export default function AssessmentEmbedClient({ data }: { data: AssessmentEmbedData }) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/assessments/${data.id}/embed`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && json?.embed_url) {
          setEmbedUrl(json.embed_url);
        } else {
          setError(json?.error ?? "Couldn't load this survey. Please try again.");
        }
      } catch {
        if (!cancelled) setError("Network error. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-semibold text-gray-900">{data.title}</h1>
          <p className="text-sm text-gray-500">{data.course_title}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {data.description && (
          <p className="mb-4 text-sm text-gray-600">{data.description}</p>
        )}

        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading survey…</div>
        ) : embedUrl ? (
          <>
            <iframe
              src={embedUrl}
              title={data.title}
              className="w-full rounded-lg border border-gray-200 bg-white"
              style={{ height: "75vh" }}
            />
            <p className="mt-3 text-xs text-gray-500">
              Your response is recorded automatically when you finish the survey above.
              It may take a moment to show as completed here.
            </p>
          </>
        ) : (
          <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <p className="mt-4 text-sm text-red-600">{error ?? "Couldn't load this survey."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
