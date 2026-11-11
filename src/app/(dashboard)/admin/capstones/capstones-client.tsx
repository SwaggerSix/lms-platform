"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, Phone } from "lucide-react";
import { PageIntro } from "@/components/ui/page-intro";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/utils/format";

export interface QueueRow {
  id: string;
  attempt: number;
  maxAttempts: number;
  status: "submitted" | "passed" | "not_yet";
  needsCall: boolean;
  anotherAttemptAllowed: boolean;
  files: { path: string; name: string; size: number }[];
  links: { label: string; url: string }[];
  note: string | null;
  submittedAt: string;
  markBy: string;
  gradedAt: string | null;
  feedback: string | null;
  certName: string;
  learnerName: string;
  learnerEmail: string;
  graderName: string | null;
  certificate: { verifyUrl: string | null; expiresAt: string | null } | null;
  portal: { status: string; at: string; invited?: boolean; error?: string } | null;
}

type Filter = "to_mark" | "needs_call" | "done" | "all";

const PORTAL_LABEL: Record<string, string> = {
  awarded: "Portal: invited and badge awarded",
  already_awarded: "Portal: badge already awarded",
  renewed: "Portal: badge renewed",
  not_applicable: "Portal: not sent (not a portal certification)",
  not_configured: "Portal: not sent, connection isn't set up",
  failed: "Portal: didn't go through",
};

function fileUrl(submissionId: string, path: string) {
  return `/api/capstones/files?submission=${submissionId}&path=${encodeURIComponent(path)}`;
}

export default function CapstonesClient({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>(rows.some((r) => r.status === "submitted") ? "to_mark" : "all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: "pass" | "not_yet" } | null>(null);

  const counts = useMemo(
    () => ({
      to_mark: rows.filter((r) => r.status === "submitted").length,
      needs_call: rows.filter((r) => r.needsCall).length,
      done: rows.filter((r) => r.status !== "submitted").length,
      all: rows.length,
    }),
    [rows]
  );
  const shown = rows
    .filter((r) =>
      filter === "to_mark" ? r.status === "submitted" : filter === "needs_call" ? r.needsCall : filter === "done" ? r.status !== "submitted" : true
    )
    .sort((a, b) =>
      filter === "to_mark" ? a.submittedAt.localeCompare(b.submittedAt) : b.submittedAt.localeCompare(a.submittedAt)
    );

  async function act(id: string, action: "pass" | "not_yet" | "allow_attempt" | "retry_portal") {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/capstones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "pass" || action === "not_yet" ? { action, feedback: feedback[id]?.trim() || undefined } : { action }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      const msg =
        action === "pass"
          ? data.portal?.status === "failed" || data.portal?.status === "not_configured"
            ? "Passed and certificate issued. The portal invite didn't go through; retry it from this row."
            : "Passed. Certificate issued and the learner emailed."
          : action === "not_yet"
            ? data.needs_call
              ? "Feedback sent. They've been told you'll set up a call."
              : "Feedback sent. They can resubmit once."
            : action === "allow_attempt"
              ? "They can submit once more, and they've been emailed."
              : PORTAL_LABEL[data.portal?.status] ?? "Sent to the portal.";
      toast.success(msg);
      setConfirm(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageIntro
        title="Capstone marking"
        description="Capstones waiting to be marked, oldest first. Learners are promised a result within 10 business days. Pass issues the certificate and invites them to the partner portal with their badge."
      />

      <Tabs value={filter} onChange={(v: string) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="to_mark">To mark ({counts.to_mark})</TabsTrigger>
          <TabsTrigger value="needs_call">Needs a call ({counts.needs_call})</TabsTrigger>
          <TabsTrigger value="done">Marked ({counts.done})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
        </TabsList>
      </Tabs>

      {shown.length === 0 ? (
        <EmptyState
          title={filter === "to_mark" ? "Nothing to mark" : "Nothing here"}
          description={filter === "to_mark" ? "New submissions appear here, and you get an email for each." : "No capstones match this view."}
        />
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const open = openId === r.id;
            const overdue = r.status === "submitted" && new Date(r.markBy) < new Date();
            return (
              <Card key={r.id}>
                <CardContent className="pt-4">
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    onClick={() => setOpenId(open ? null : r.id)}
                    aria-expanded={open}
                  >
                    <span>
                      <span className="font-medium text-gray-900">{r.learnerName}</span>{" "}
                      <span className="text-sm text-gray-500">{r.learnerEmail}</span>
                      <span className="block text-sm text-gray-600">
                        {r.certName} · attempt {r.attempt} of {r.maxAttempts}
                        {r.attempt > r.maxAttempts ? " (allowed after a call)" : ""} · submitted {formatDate(r.submittedAt)}
                      </span>
                    </span>
                    <span className="text-sm">
                      {r.status === "submitted" && (
                        <span className={overdue ? "font-medium text-red-600" : "text-amber-700"}>
                          {overdue ? "Overdue: " : "Mark by "}
                          {formatDate(r.markBy)}
                        </span>
                      )}
                      {r.status === "passed" && <span className="text-green-700">Passed {r.gradedAt ? formatDate(r.gradedAt) : ""}</span>}
                      {r.status === "not_yet" && (
                        <span className={r.needsCall ? "font-medium text-primary-700" : "text-gray-600"}>
                          {r.needsCall ? "Not yet: set up a call" : r.anotherAttemptAllowed ? "Not yet: another attempt allowed" : "Not yet: can resubmit"}
                        </span>
                      )}
                    </span>
                  </button>

                  {open && (
                    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4 text-sm">
                      <div>
                        <p className="mb-1 font-semibold text-gray-900">Submitted</p>
                        <ul className="space-y-1">
                          {r.files.map((f) => (
                            <li key={f.path} className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" aria-hidden="true" />
                              <a href={fileUrl(r.id, f.path)} className="text-primary-600 hover:underline">{f.name}</a>
                            </li>
                          ))}
                          {r.links.map((l, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4 text-gray-400" aria-hidden="true" />
                              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{l.label}</a>
                              <span className="truncate text-gray-400">{l.url}</span>
                            </li>
                          ))}
                        </ul>
                        {r.note && <p className="mt-2 whitespace-pre-line rounded bg-gray-50 p-3 text-gray-700">{r.note}</p>}
                      </div>

                      {r.feedback && (
                        <div>
                          <p className="mb-1 font-semibold text-gray-900">
                            Feedback{r.graderName ? ` (${r.graderName}` : ""}{r.gradedAt ? `${r.graderName ? ", " : " ("}${formatDate(r.gradedAt)})` : r.graderName ? ")" : ""}
                          </p>
                          <p className="whitespace-pre-line rounded bg-gray-50 p-3 text-gray-700">{r.feedback}</p>
                        </div>
                      )}

                      {r.status === "submitted" && (
                        <div className="space-y-3">
                          <label htmlFor={`fb-${r.id}`} className="font-semibold text-gray-900">
                            Feedback to the learner
                          </label>
                          <p className="text-gray-600">
                            Required for "Not yet" (they get it by email, word for word). Optional for a pass.
                            {r.attempt >= r.maxAttempts ? " This is their last allowed attempt: \"Not yet\" tells them you'll set up a call." : " \"Not yet\" lets them resubmit once."}
                          </p>
                          <Textarea
                            id={`fb-${r.id}`}
                            rows={6}
                            value={feedback[r.id] ?? ""}
                            onChange={(e) => setFeedback((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          />
                          {confirm?.id === r.id ? (
                            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                              <span className="text-amber-900">
                                {confirm.action === "pass"
                                  ? "Issue the certificate, email them and invite them to the portal?"
                                  : "Send this feedback as \"Not yet\"?"}
                              </span>
                              <Button size="sm" onClick={() => act(r.id, confirm.action)} disabled={busy === r.id}>
                                {busy === r.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                Confirm
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setConfirm(null)} disabled={busy === r.id}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button variant="success" onClick={() => setConfirm({ id: r.id, action: "pass" })}>
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                Pass
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => setConfirm({ id: r.id, action: "not_yet" })}
                                disabled={(feedback[r.id]?.trim().length ?? 0) < 20}
                              >
                                Not yet
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {r.needsCall && (
                        <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary-200 bg-primary-50 p-3">
                          <Phone className="h-4 w-4 text-primary-700" aria-hidden="true" />
                          <span className="text-primary-900">
                            Set up a call with {r.learnerName} ({r.learnerEmail}). Afterwards, you can let them submit once more.
                          </span>
                          <Button size="sm" variant="secondary" onClick={() => act(r.id, "allow_attempt")} disabled={busy === r.id}>
                            Allow another attempt
                          </Button>
                        </div>
                      )}

                      {r.status === "passed" && (
                        <div className="space-y-2">
                          {r.certificate?.verifyUrl && (
                            <p>
                              Certificate:{" "}
                              <a href={r.certificate.verifyUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                {r.certificate.verifyUrl}
                              </a>
                              {r.certificate.expiresAt ? ` · valid until ${formatDate(r.certificate.expiresAt)}` : ""}
                            </p>
                          )}
                          <p className="flex flex-wrap items-center gap-2">
                            {r.portal?.status === "failed" || r.portal?.status === "not_configured" ? (
                              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                            )}
                            <span>{r.portal ? PORTAL_LABEL[r.portal.status] ?? r.portal.status : "Portal: not sent yet"}</span>
                            {r.portal?.error && <span className="text-gray-500">({r.portal.error})</span>}
                            {(!r.portal || r.portal.status === "failed" || r.portal.status === "not_configured") && (
                              <Button size="sm" variant="secondary" onClick={() => act(r.id, "retry_portal")} disabled={busy === r.id}>
                                Retry portal invite
                              </Button>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
