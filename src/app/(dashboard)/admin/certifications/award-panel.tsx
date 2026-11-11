'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface Holder {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  memoPassedOn: string | null;
  briefingPassedOn: string | null;
}

interface Ready {
  userId: string;
  name: string;
  email: string;
  completedAt: string | null;
}

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Award a staff-awarded credential (e.g. Mosaic Certified). Lists learners who
 * have completed the required course and aren't certified yet; the assessor
 * enters the dates the memo and briefing were passed and presses Award.
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
  const [selected, setSelected] = useState<string | null>(null);
  const [memo, setMemo] = useState(today());
  const [briefing, setBriefing] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/certifications/award?certification_id=${certificationId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not load learners');
      setHolders(body.holders);
      setReady(body.ready);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [certificationId]);

  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setConfirmRevoke(null);
      load();
    }
  }, [isOpen, load]);

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
          memo_passed_on: memo,
          briefing_passed_on: briefing,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not award');
      onChanged(body.reawarded ? { issued: 0, active: 1, expired: -1 } : { issued: 1, active: 1, expired: 0 });
      setSelected(null);
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Award: ${certificationName}`} size="lg">
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          Award this only after you have marked the learner&apos;s interpretation memo and executive
          briefing as passing. Passing the course exam alone does not certify anyone.
        </p>

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
              <h3 className="text-sm font-semibold text-gray-900">Ready to certify ({ready.length})</h3>
              <p className="mt-0.5 text-xs text-gray-500">Passed the course exam, not certified yet.</p>
              {ready.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Nobody yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {ready.map((r) => (
                    <li key={r.userId} className="p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
                          <p className="truncate text-xs text-gray-500">
                            {r.email} · exam passed {fmt(r.completedAt)}
                          </p>
                        </div>
                        {selected !== r.userId && (
                          <button
                            type="button"
                            onClick={() => setSelected(r.userId)}
                            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
                          >
                            Award…
                          </button>
                        )}
                      </div>
                      {selected === r.userId && (
                        <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="text-xs font-medium text-gray-700">
                              Memo passed on
                              <input
                                type="date"
                                value={memo}
                                max={today()}
                                onChange={(e) => setMemo(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <label className="text-xs font-medium text-gray-700">
                              Briefing passed on
                              <input
                                type="date"
                                value={briefing}
                                max={today()}
                                onChange={(e) => setBriefing(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                          </div>
                          <label className="block text-xs font-medium text-gray-700">
                            Note (optional)
                            <input
                              type="text"
                              value={note}
                              maxLength={1000}
                              onChange={(e) => setNote(e.target.value)}
                              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busy || !memo || !briefing}
                              onClick={() => award(r)}
                              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Confirm: memo and briefing passed, award
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelected(null)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

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
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => revoke(h)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirm revoke
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRevoke(null)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRevoke(h.id)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
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
