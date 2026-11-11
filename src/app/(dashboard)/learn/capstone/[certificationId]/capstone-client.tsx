"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Loader2, Video, AlertTriangle, FileText } from "lucide-react";
import { uploadCapstoneFile } from "@/lib/certifications/capstone-upload";

type Status = "submitted" | "passed" | "resubmit" | "not_passed";

interface Submission {
  id: string;
  kind: "memo" | "briefing";
  attempt: number;
  status: Status;
  submittedAt: string;
  fileName: string | null;
  hasFile: boolean;
  link: string | null;
  reviewedAt: string | null;
  feedback: string | null;
}

interface Question {
  position: number;
  revealedAt: string | null;
  answered: boolean;
  prompt: { speaker: string; text: string } | null;
}

interface View {
  certification: { id: string; name: string };
  config: {
    title: string;
    intro: string;
    memo: { title: string; instructions: string[] };
    briefing: { title: string; instructions: string[] };
    turnaround: string;
    pushback: { count: number; prepSeconds: number; answerSeconds: number };
  };
  certified: boolean;
  submissions: Submission[];
  next: { memo: number | null; briefing: number | null };
  pushback: { submissionId: string; open: boolean; questions: Question[] } | null;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function StatusLine({ s, turnaround }: { s: Submission; turnaround: string }) {
  const label: Record<Status, { text: string; cls: string }> = {
    submitted: { text: `Handed in ${fmtDate(s.submittedAt)}. Your assessor will reply in ${turnaround}.`, cls: "bg-blue-50 text-blue-800 border-blue-200" },
    passed: { text: `Passed${s.reviewedAt ? ` on ${fmtDate(s.reviewedAt)}` : ""}.`, cls: "bg-green-50 text-green-800 border-green-200" },
    resubmit: { text: "Not there yet. Read the feedback below and hand in your one resubmission.", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    not_passed: { text: "Your resubmission didn't meet the bar. Contact your assessor about next steps.", cls: "bg-red-50 text-red-800 border-red-200" },
  };
  const l = label[s.status];
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${l.cls}`}>
      <p>
        {s.attempt > 1 ? "Resubmission: " : ""}
        {l.text}
      </p>
      {s.feedback && (
        <div className="mt-2 whitespace-pre-wrap border-t border-current/20 pt-2 text-gray-800">
          <span className="font-medium">Feedback: </span>
          {s.feedback}
        </div>
      )}
    </div>
  );
}

function HandIn({
  certificationId,
  kind,
  allowLink,
  accept,
  onDone,
}: {
  certificationId: string;
  kind: "memo" | "briefing";
  allowLink: boolean;
  accept: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let path: string | undefined;
      if (file) path = await uploadCapstoneFile(certificationId, kind, file, setPct);
      const res = await fetch(`/api/certifications/${certificationId}/capstone/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ...(path ? { path, file_name: file?.name } : {}),
          ...(!path && link.trim() ? { link: link.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not hand this in.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPct(null);
    }
  };

  const ready = !!file || (allowLink && link.trim().length > 0);
  return (
    <div className="mt-4 space-y-3 rounded-lg bg-gray-50 p-4">
      <label className="block text-sm font-medium text-gray-700">
        {allowLink ? "Upload a video file (up to 50 MB)" : "Upload your memo"}
        <input
          type="file"
          accept={accept}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-primary-700"
        />
      </label>
      {allowLink && (
        <label className="block text-sm font-medium text-gray-700">
          …or paste a link to the recording
          <input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={link}
            disabled={!!file}
            onChange={(e) => setLink(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Make sure anyone with the link can view it.
          </span>
        </label>
      )}
      <label className="block text-sm font-medium text-gray-700">
        Note for your assessor (optional)
        <textarea
          value={note}
          maxLength={2000}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={submit}
        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy && pct != null ? `Uploading ${pct}%` : "Hand in"}
      </button>
    </div>
  );
}

/** Seconds left until `end`, ticking. */
function useCountdown(end: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (end == null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [end]);
  return end == null ? null : Math.max(0, Math.ceil((end - now) / 1000));
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

function Pushback({
  certificationId,
  pb,
  prepSeconds,
  answerSeconds,
  onChange,
}: {
  certificationId: string;
  pb: NonNullable<View["pushback"]>;
  prepSeconds: number;
  answerSeconds: number;
  onChange: () => void;
}) {
  const current = pb.questions.find((q) => !q.answered) ?? null;
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recEnd, setRecEnd] = useState<number | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [fallbackFile, setFallbackFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);
  const canRecord = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!pickMime();

  const prepEnd = current?.revealedAt ? new Date(current.revealedAt).getTime() + prepSeconds * 1000 : null;
  const prepLeft = useCountdown(prepEnd);
  const recLeft = useCountdown(recEnd);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, current?.position]);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const startCamera = async () => {
    setCamError(null);
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
    } catch {
      setCamError("We couldn't use your camera and microphone. Allow them in your browser, or upload a recording instead.");
    }
  };

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (!stream || recording) return;
    const mime = pickMime();
    chunks.current = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      setRecording(false);
      setRecEnd(null);
      setBlob(new Blob(chunks.current, { type: (mime ?? "video/webm").split(";")[0] }));
    };
    recRef.current = rec;
    rec.start(1000);
    setRecording(true);
    setBlob(null);
    setRecEnd(Date.now() + answerSeconds * 1000);
  }, [stream, recording, answerSeconds]);

  // Recording starts on its own when the thinking time runs out, and stops at the cap.
  useEffect(() => {
    if (prepLeft === 0 && stream && !recording && !blob && current?.revealedAt) startRecording();
  }, [prepLeft, stream, recording, blob, current?.revealedAt, startRecording]);
  useEffect(() => {
    if (recLeft === 0 && recording) stop();
  }, [recLeft, recording, stop]);

  const reveal = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/certifications/${certificationId}/capstone/pushback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reveal", submission_id: pb.submissionId, position: current.position }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not show the question.");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendAnswer = async () => {
    if (!current) return;
    const file = blob ?? fallbackFile;
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const path = await uploadCapstoneFile(certificationId, "pushback", file);
      const res = await fetch(`/api/certifications/${certificationId}/capstone/pushback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          submission_id: pb.submissionId,
          position: current.position,
          path,
          recorded_in_browser: !!blob,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not hand in your answer.");
      setBlob(null);
      setFallbackFile(null);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const done = pb.questions.filter((q) => q.answered).length;
  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Pushback questions</h2>
      <p className="mt-1 text-sm text-gray-600">
        {done} of {pb.questions.length} answered. Each question appears only when you press Show. You then get{" "}
        {prepSeconds} seconds to think, and recording starts on its own for up to {answerSeconds / 60} minutes. Your
        assessor sees how long each answer took.
      </p>

      {!current ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> All three answered. Your assessor will mark the briefing and the answers together.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {canRecord && !stream && (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <p>Start your camera first, so you're ready before the clock starts.</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium hover:bg-gray-50"
              >
                <Video className="h-4 w-4" /> Start camera
              </button>
              {camError && <p className="mt-2 text-red-700">{camError}</p>}
            </div>
          )}
          {stream && (
            <video ref={videoRef} autoPlay muted playsInline className="w-full max-w-md rounded-lg bg-black" aria-label="Your camera" />
          )}

          {!current.revealedAt ? (
            <div>
              <p className="text-sm font-medium text-gray-900">Question {current.position} of {pb.questions.length}</p>
              <button
                type="button"
                disabled={busy || (canRecord && !stream && !camError)}
                onClick={reveal}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Show question {current.position} and start the clock
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <blockquote className="rounded-lg border-l-4 border-primary-500 bg-primary-50 px-4 py-3 text-gray-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{current.prompt?.speaker}</p>
                <p className="mt-1">“{current.prompt?.text}”</p>
              </blockquote>
              {prepLeft != null && prepLeft > 0 && !recording && !blob && (
                <p className="flex items-center gap-2 text-sm text-gray-700" aria-live="polite">
                  <Clock className="h-4 w-4" /> Thinking time: {mmss(prepLeft)}
                  {stream && (
                    <button type="button" onClick={startRecording} className="ml-2 text-primary-700 underline">
                      Start recording now
                    </button>
                  )}
                </p>
              )}
              {recording && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-red-700" aria-live="polite">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" /> Recording · {mmss(recLeft ?? 0)} left
                  </span>
                  <button type="button" onClick={stop} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium">
                    Stop
                  </button>
                </div>
              )}
              {blob && (
                <div className="space-y-2">
                  <video src={blobUrl ?? undefined} controls className="w-full max-w-md rounded-lg bg-black" />
                  <p className="text-sm text-gray-600">This is what will be sent. You can't re-record once the time is up.</p>
                </div>
              )}
              {(!canRecord || camError) && !blob && (
                <label className="block text-sm font-medium text-gray-700">
                  Upload your recorded answer (MP4, WebM or MOV, up to 50 MB)
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => setFallbackFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-sm"
                  />
                </label>
              )}
              {(blob || fallbackFile) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={sendAnswer}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Hand in answer {current.position}
                </button>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default function CapstoneClient({ certificationId }: { certificationId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/certifications/${certificationId}/capstone`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load your capstone.");
      setView(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [certificationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p role="alert" className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" /> {error}
        </p>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-10 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const latest = (kind: "memo" | "briefing") =>
    view.submissions.filter((s) => s.kind === kind).sort((a, b) => b.attempt - a.attempt)[0] ?? null;
  const memo = latest("memo");
  const briefing = latest("briefing");

  const task = (
    kind: "memo" | "briefing",
    cfg: { title: string; instructions: string[] },
    s: Submission | null,
    next: number | null
  ) => (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        {kind === "memo" ? <FileText className="h-5 w-5 text-gray-400" /> : <Video className="h-5 w-5 text-gray-400" />}
        {cfg.title}
      </h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
        {cfg.instructions.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {s && <StatusLine s={s} turnaround={view.config.turnaround} />}
      {next != null && (
        <HandIn
          certificationId={certificationId}
          kind={kind}
          allowLink={kind === "briefing"}
          accept={
            kind === "memo"
              ? ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "video/mp4,video/webm,video/quicktime"
          }
          onDone={load}
        />
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/learn/certifications" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> My Certifications
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">{view.config.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{view.certification.name}</p>
        {view.certified ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
            <CheckCircle2 className="h-5 w-5" /> You're certified. Well done.
          </p>
        ) : (
          <p className="mt-4 text-gray-700">{view.config.intro}</p>
        )}

        {task("memo", view.config.memo, memo, view.next.memo)}
        {task("briefing", view.config.briefing, briefing, view.next.briefing)}
        {view.pushback && view.pushback.open && (
          <Pushback
            certificationId={certificationId}
            pb={view.pushback}
            prepSeconds={view.config.pushback.prepSeconds}
            answerSeconds={view.config.pushback.answerSeconds}
            onChange={load}
          />
        )}
      </div>
    </div>
  );
}
