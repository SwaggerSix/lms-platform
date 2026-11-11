'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

type Status = 'submitted' | 'passed' | 'resubmit' | 'not_passed';

interface Holder {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
}

interface Ready {
  userId: string;
  name: string;
  email: string;
  completedAt?: string | null;
}

interface PushbackAnswer {
  position: number;
  prompt: { speaker: string; text: string };
  revealedAt: string | null;
  answeredAt: string | null;
  seconds: number | null;
  late: boolean;
  hasFile: boolean;
  recordedInBrowser: boolean;
}

interface Piece {
  id: string;
  attempt: number;
  status: Status;
  submittedAt: string;
  reviewedAt: string | null;
  feedback: string | null;
  fileName: string | null;
  hasFile: boolean;
  link: string | null;
  note: string | null;
  pushback: PushbackAnswer[];
}

interface Work {
  pieces: Record<string, Piece | null>;
  passDates: Record<string, string> | null;
}

interface PieceInfo {
  kind: string;
  label: string;
  pushback: boolean;
  requiredNote: string | null;
}

interface Capstone {
  pieces: PieceInfo[];
  work: Record<string, Work>;
  handedIn: Ready[];
  notifyMe: boolean;
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<Status, { text: string; cls: string }> = {
  submitted: { text: 'To mark', cls: 'bg-blue-100 text-blue-800' },
  passed: { text: 'Passed', cls: 'bg-green-100 text-green-800' },
  resubmit: { text: 'Sent back', cls: 'bg-amber-100 text-amber-800' },
  not_passed: { text: 'Not passed', cls: 'bg-red-100 text-red-800' },
};

function Chip({ label, piece }: { label: string; piece: Piece | null }) {
  const s = piece ? STATUS_LABEL[piece.status] : { text: 'Not handed in', cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {label}: {s.text}
      {piece && piece.attempt > 1 ? ' (2nd)' : ''}
    </span>
  );
}

function PieceReview({
  certificationId,
  info,
  piece,
  onMarked,
}: {
  certificationId: string;
  info: PieceInfo;
  piece: Piece;
  onMarked: () => Promise<void>;
}) {
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileHref = (position?: number) =>
    `/api/certifications/${certificationId}/capstone/file?submission_id=${piece.id}${position ? `&position=${position}` : ''}`;
  const allAnswered = piece.pushback.length > 0 && piece.pushback.every((p) => p.answeredAt);

  const mark = async (decision: Status) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/certifications/award/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: piece.id, decision, ...(feedback.trim() ? { feedback: feedback.trim() } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save the mark');
      setFeedback('');
      await onMarked();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">
          {info.label}
          {piece.attempt > 1 ? ' · resubmission' : ''}
        </p>
        <span className="text-xs text-gray-500">Handed in {fmt(piece.submittedAt)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        {piece.hasFile && (
          <a href={fileHref()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 underline">
            <ExternalLink className="h-3.5 w-3.5" /> Open {piece.fileName ?? 'file'}
          </a>
        )}
        {piece.link && (
          <a href={piece.link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary-700 underline">
            <ExternalLink className="h-3.5 w-3.5" /> Open link
          </a>
        )}
      </div>
      {piece.note && (
        <p className="mt-2 whitespace-pre-wrap text-xs text-gray-600">
          {info.requiredNote ?? 'Learner’s note'}: {piece.note}
        </p>
      )}

      {info.pushback && (
        <ol className="mt-3 space-y-2">
          {piece.pushback.map((p) => (
            <li key={p.position} className="rounded-md bg-gray-50 p-2 text-xs text-gray-700">
              <p>
                <span className="font-medium">Q{p.position} · {p.prompt.speaker}:</span> “{p.prompt.text}”
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2">
                {!p.revealedAt ? (
                  'Not shown yet'
                ) : !p.answeredAt ? (
                  `Shown ${fmt(p.revealedAt)}, not answered yet`
                ) : (
                  <>
                    <span className={p.late ? 'inline-flex items-center gap-1 font-medium text-amber-700' : ''}>
                      {p.late && <AlertTriangle className="h-3 w-3" />}
                      Answered {Math.floor((p.seconds ?? 0) / 60)}m {(p.seconds ?? 0) % 60}s after it was shown
                      {p.recordedInBrowser ? '' : ' (uploaded file, not recorded here)'}
                    </span>
                    {p.hasFile && (
                      <a href={fileHref(p.position)} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">
                        Watch
                      </a>
                    )}
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}

      {piece.status === 'submitted' ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={5000}
            rows={3}
            placeholder="Feedback for the learner (required to send back)"
            className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || (info.pushback && !allAnswered)}
              title={info.pushback && !allAnswered ? 'Waiting for all three pushback answers' : undefined}
              onClick={() => mark('passed')}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Pass
            </button>
            {piece.attempt < 2 ? (
              <button
                type="button"
                disabled={busy || !feedback.trim()}
                onClick={() => mark('resubmit')}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
              >
                Send back for resubmission
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !feedback.trim()}
                onClick={() => mark('not_passed')}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Not passed
              </button>
            )}
            {busy && <Loader2 className="h-4 w-4 animate-spin self-center" />}
          </div>
          <p className="text-xs text-gray-500">The learner is emailed your mark and feedback.</p>
        </div>
      ) : (
        piece.feedback && <p className="mt-2 whitespace-pre-wrap text-xs text-gray-600">Your feedback: {piece.feedback}</p>
      )}
    </div>
  );
}

/**
 * Award a staff-awarded credential (e.g. Mosaic Certified). For a credential
 * with a capstone, it is also where the assessor marks each piece of the learner's
 * work; Award appears once every piece has passed and the course exam is passed.
 * Without a capstone, the assessor enters the dates the work passed.
 */
export default function AwardPanel({
  certificationId,
  certificationName,
  isOpen,
  onClose,
  onChanged,
}: {
  certificationId: string;
  certificationName: string;
  isOpen: boolean;
  onClose: () => void;
  onChanged: (delta: { issued: number; active: number; expired: number }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [ready, setReady] = useState<Ready[]>([]);
  const [capstone, setCapstone] = useState<Capstone | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [memo, setMemo] = useState(today());
  const [briefing, setBriefing] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/certifications/award?certification_id=${certificationId}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not load learners');
      setHolders(body.holders);
      setReady(body.ready);
      setCapstone(body.capstone ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [certificationId]);

  useEffect(() => {
    if (isOpen) {
      setOpen(null);
      setConfirmRevoke(null);
      setLoading(true);
      load();
    }
  }, [isOpen, load]);

  const toggleNotify = async (on: boolean) => {
    setCapstone((c) => (c ? { ...c, notifyMe: on } : c));
    const res = await fetch('/api/certifications/award/notify', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ certification_id: certificationId, on }),
    });
    if (!res.ok) {
      setCapstone((c) => (c ? { ...c, notifyMe: !on } : c));
      setError('Could not save that setting');
    }
  };

  const award = async (learner: Ready) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/certifications/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certification_id: certificationId,
          user_id: learner.userId,
          ...(capstone ? {} : { memo_passed_on: memo, briefing_passed_on: briefing }),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not award');
      onChanged(body.reawarded ? { issued: 0, active: 1, expired: -1 } : { issued: 1, active: 1, expired: 0 });
      setOpen(null);
      setNote('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (holder: Holder) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/certifications/award?id=${holder.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not revoke');
      onChanged({ issued: 0, active: -1, expired: 1 });
      setConfirmRevoke(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const active = holders.filter((h) => h.status === 'active');

  const learnerRow = (r: Ready, examPassed: boolean) => {
    const w = capstone?.work[r.userId] ?? null;
    const canAward = examPassed && (capstone ? !!w?.passDates : true);
    const toMark = !!w && Object.values(w.pieces).some((p) => p?.status === 'submitted');
    return (
      <li key={r.userId} className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
            <p className="truncate text-xs text-gray-500">
              {r.email} · {examPassed ? `exam passed ${fmt(r.completedAt)}` : 'exam not passed yet'}
            </p>
            {capstone && (
              <div className="mt-1 flex flex-wrap gap-1">
                {capstone.pieces.map((pc) => (
                  <Chip key={pc.kind} label={pc.label} piece={w?.pieces[pc.kind] ?? null} />
                ))}
              </div>
            )}
          </div>
          {open !== r.userId && (capstone ? !!w || canAward : true) && (
            <button
              type="button"
              onClick={() => setOpen(r.userId)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                canAward || toMark ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {canAward ? 'Award…' : toMark ? 'Mark…' : 'Open'}
            </button>
          )}
        </div>
        {open === r.userId && (
          <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
            {capstone &&
              w &&
              capstone.pieces.map((pc) => {
                const piece = w.pieces[pc.kind];
                return piece ? (
                  <PieceReview key={pc.kind} certificationId={certificationId} info={pc} piece={piece} onMarked={load} />
                ) : null;
              })}
            {canAward && (
              <div className="space-y-3 rounded-lg border border-green-200 bg-white p-3">
                {capstone && w?.passDates ? (
                  <p className="text-sm text-gray-700">
                    {capstone.pieces.map((pc) => `${pc.label} passed ${fmt(w.passDates![pc.kind])}`).join(' · ')}. Ready to award.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-gray-700">
                      Memo passed on
                      <input type="date" value={memo} max={today()} onChange={(e) => setMemo(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-gray-700">
                      Briefing passed on
                      <input type="date" value={briefing} max={today()} onChange={(e) => setBriefing(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </label>
                  </div>
                )}
                <label className="block text-xs font-medium text-gray-700">
                  Note (optional)
                  <input type="text" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                </label>
                <button
                  type="button"
                  disabled={busy || (!capstone && (!memo || !briefing))}
                  onClick={() => award(r)}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Award {certificationName}
                </button>
              </div>
            )}
            <button type="button" onClick={() => setOpen(null)} className="text-sm text-gray-600 underline">
              Close
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Award: ${certificationName}`} size="lg">
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          {capstone
            ? `Mark each learner’s ${capstone.pieces.map((p) => p.label).join(' and ')} here. Award appears once ${capstone.pieces.length > 1 ? 'all have' : 'it has'} passed and the course exam is passed. Passing the exam alone does not certify anyone.`
            : 'Award this only after you have marked the learner’s work as passing. Passing the course exam alone does not certify anyone.'}
        </p>

        {capstone && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={capstone.notifyMe} onChange={(e) => toggleNotify(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Email me when a learner hands in work
          </label>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading learners…
          </div>
        ) : (
          <>
            <section>
              <h3 className="text-sm font-semibold text-gray-900">Exam passed, not certified yet ({ready.length})</h3>
              {ready.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Nobody yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">{ready.map((r) => learnerRow(r, true))}</ul>
              )}
            </section>

            {capstone && capstone.handedIn.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900">Handed in work, exam not passed yet ({capstone.handedIn.length})</h3>
                <p className="mt-0.5 text-xs text-gray-500">You can mark their work now; Award waits for the exam.</p>
                <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {capstone.handedIn.map((r) => learnerRow(r, false))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-gray-900">Certified ({active.length})</h3>
              {active.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Nobody yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {active.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{h.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {h.email} · awarded {fmt(h.issuedAt)} · valid until {fmt(h.expiresAt)}
                        </p>
                      </div>
                      {confirmRevoke === h.id ? (
                        <div className="flex gap-1">
                          <button type="button" disabled={busy} onClick={() => revoke(h)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                            Confirm revoke
                          </button>
                          <button type="button" onClick={() => setConfirmRevoke(null)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmRevoke(h.id)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                          Revoke
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
