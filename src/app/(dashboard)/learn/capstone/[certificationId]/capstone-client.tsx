"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileText, Link2, Loader2, Lock, Phone, Trash2, Upload } from "lucide-react";
import { PageIntro } from "@/components/ui/page-intro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { MarkdownLite } from "@/components/help/markdown-lite";
import { formatDate } from "@/utils/format";
import type { CapstoneState, CapstoneStatus } from "@/lib/capstones/rules";

export interface AttemptView {
  id: string;
  attempt: number;
  status: CapstoneStatus;
  submittedAt: string;
  markBy: string;
  gradedAt: string | null;
  feedback: string | null;
  files: { name: string; path: string; size: number }[];
  links: { label: string; url: string }[];
  note: string | null;
}

interface UploadedFile {
  key: string;
  name: string;
  path: string | null;
  progress: number;
  error?: string;
}

function putFile(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and try again."));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

function fileUrl(submissionId: string, path: string) {
  return `/api/capstones/files?submission=${submissionId}&path=${encodeURIComponent(path)}`;
}

function sizeLabel(bytes: number) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const STATUS_LABEL: Record<CapstoneStatus, string> = {
  submitted: "Being marked",
  passed: "Passed",
  not_yet: "Not yet",
};

export default function CapstoneClient(props: {
  certificationId: string;
  certName: string;
  instructions: string | null;
  state: CapstoneState;
  progress: { complete: boolean; total: number; done: number };
  maxAttempts: number;
  path: { title: string; slug: string } | null;
  attempts: AttemptView[];
}) {
  const { certificationId, certName, instructions, state, progress, maxAttempts, path, attempts } = props;
  const router = useRouter();
  const toast = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([{ label: "", url: "" }]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const uploading = files.some((f) => !f.path && !f.error);
  const readyFiles = files.filter((f) => f.path);
  const readyLinks = links.filter((l) => l.label.trim() && l.url.trim());

  async function addFiles(list: FileList | null) {
    if (!list) return;
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setFiles((prev) => [...prev, { key, name: file.name, path: null, progress: 0 }]);
      const update = (patch: Partial<UploadedFile>) =>
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
      try {
        const res = await fetch(`/api/capstones/${certificationId}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_name: file.name, file_size: file.size }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not start the upload.");
        await putFile(data.signedUrl, file, (pct) => update({ progress: pct }));
        update({ path: data.path, progress: 100 });
      } catch (err) {
        update({ error: err instanceof Error ? err.message : "Upload failed." });
      }
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/capstones/${certificationId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: readyFiles.map((f) => ({ path: f.path, name: f.name })),
          links: readyLinks.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit.");
      toast.success(`Submitted. Expect your result by ${data.mark_by}.`);
      setFiles([]);
      setLinks([{ label: "", url: "" }]);
      setNote("");
      setConfirming(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  const latest = attempts[attempts.length - 1];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <PageIntro
        title={`${certName}: capstone`}
        description="The last step to certification. You'll find the brief, what to submit and how it's marked below."
      />

      {/* Where you stand */}
      <Card>
        <CardContent className="pt-6">
          {state.kind === "locked" && (
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-900">Opens when you've finished every course</p>
                <p className="mt-1">
                  You've completed {progress.done} of {progress.total}.{" "}
                  {path && (
                    <Link href={`/learn/paths/${path.slug}`} className="font-medium text-primary-600 hover:underline">
                      Go to {path.title}
                    </Link>
                  )}
                </p>
              </div>
            </div>
          )}
          {state.kind === "open" && (
            <div className="flex items-start gap-3">
              <Upload className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-900">
                  {state.nextAttempt === 1 ? "Your capstone is open" : `Ready for attempt ${state.nextAttempt}`}
                </p>
                <p className="mt-1">
                  Read the brief, then submit everything at once below. You get {maxAttempts} attempt{maxAttempts === 1 ? "" : "s"}; marking takes up to 10 business days.
                </p>
              </div>
            </div>
          )}
          {state.kind === "waiting" && latest && (
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-900">Submitted {formatDate(latest.submittedAt)}: being marked</p>
                <p className="mt-1">Expect your result by {formatDate(latest.markBy)}. We'll email you.</p>
              </div>
            </div>
          )}
          {state.kind === "passed" && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-900">You passed. You're certified.</p>
                <p className="mt-1">
                  <Link href="/learn/certifications" className="font-medium text-primary-600 hover:underline">
                    Download your certificate and share its verification link
                  </Link>
                </p>
              </div>
            </div>
          )}
          {state.kind === "needs_call" && (
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-900">Next step: a call with your assessor</p>
                <p className="mt-1">Your assessor will be in touch to set it up. The feedback on your last attempt is below.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The brief */}
      <Card>
        <CardHeader>
          <CardTitle>The brief</CardTitle>
        </CardHeader>
        <CardContent>
          {instructions ? (
            <MarkdownLite source={instructions} />
          ) : (
            <p className="text-sm text-gray-600">The capstone brief will appear here.</p>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      {state.kind === "open" && (
        <Card>
          <CardHeader>
            <CardTitle>Submit attempt {state.nextAttempt}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section aria-labelledby="files-heading" className="space-y-2">
              <h3 id="files-heading" className="text-sm font-semibold text-gray-900">Files</h3>
              <p className="text-sm text-gray-600">PDF, Word, PowerPoint, Excel, PNG or JPEG, up to 50 MB each.</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-primary-500">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Add files
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    void addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {files.length > 0 && (
                <ul className="divide-y divide-gray-100 rounded-md border border-gray-200" aria-live="polite">
                  {files.map((f) => (
                    <li key={f.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      {f.error ? (
                        <span className="text-red-600">{f.error}</span>
                      ) : f.path ? (
                        <span className="text-green-700">Uploaded</span>
                      ) : (
                        <span className="text-gray-500">{f.progress}%</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}
                        className="rounded p-1 text-gray-400 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        aria-label={`Remove ${f.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="links-heading" className="space-y-2">
              <h3 id="links-heading" className="text-sm font-semibold text-gray-900">Links</h3>
              <p className="text-sm text-gray-600">
                For recordings: upload them to an unlisted video link or a shared drive anyone with the link can view, then paste the link here.
              </p>
              {links.map((l, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    aria-label={`Link ${i + 1} label`}
                    placeholder="What it is (e.g. Board briefing recording)"
                    value={l.label}
                    onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    className="sm:w-2/5"
                  />
                  <Input
                    aria-label={`Link ${i + 1} URL`}
                    placeholder="https://"
                    type="url"
                    value={l.url}
                    onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                    className="flex-1"
                  />
                </div>
              ))}
              {links.length < 10 && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])}>
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  Add another link
                </Button>
              )}
            </section>

            <section className="space-y-2">
              <label htmlFor="capstone-note" className="text-sm font-semibold text-gray-900">
                Note to your assessor (optional)
              </label>
              <Textarea id="capstone-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} />
            </section>

            {!confirming ? (
              <Button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={uploading || (readyFiles.length === 0 && readyLinks.length === 0)}
              >
                Review and submit
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p>
                  You're submitting {readyFiles.length} file{readyFiles.length === 1 ? "" : "s"} and {readyLinks.length} link
                  {readyLinks.length === 1 ? "" : "s"} as attempt {state.nextAttempt} of {maxAttempts}. You can't change it once it's in.
                  Check the brief's checklist first.
                </p>
                <div className="flex gap-2">
                  <Button type="button" onClick={submit} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Submit attempt {state.nextAttempt}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={submitting}>
                    Keep editing
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your attempts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {[...attempts].reverse().map((a) => (
              <div key={a.id} className="space-y-2 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-gray-900">
                  Attempt {a.attempt} · {STATUS_LABEL[a.status]} · submitted {formatDate(a.submittedAt)}
                </p>
                <ul className="space-y-1 text-sm">
                  {a.files.map((f) => (
                    <li key={f.path}>
                      <a href={fileUrl(a.id, f.path)} className="text-primary-600 hover:underline">
                        {f.name}
                      </a>{" "}
                      <span className="text-gray-500">{sizeLabel(f.size)}</span>
                    </li>
                  ))}
                  {a.links.map((l, i) => (
                    <li key={i}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
                {a.feedback && (
                  <div className="rounded-md border-l-4 border-primary-300 bg-gray-50 px-4 py-3 text-sm text-gray-800 whitespace-pre-line">
                    <p className="mb-1 font-semibold">Feedback</p>
                    {a.feedback}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
