"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSessionsTabs from "@/components/layout/admin-sessions-tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Mail, X, Users, Calendar, ExternalLink, FileSignature, FileQuestion } from "lucide-react";

interface Course { id: string; title: string }
interface Instructor { id: string; name: string }

interface ClassRow {
  id: string;
  title: string;
  course_title: string;
  status: string;
  start_date: string | null;
  participant_count: number;
  nasba_certified?: boolean;
  nasba_cpe_credits?: number | null;
  contract_number?: string | null;
  contract_url?: string | null;
  contract_file_name?: string | null;
}

interface Invitation {
  id: string;
  email: string;
  invited_role: string;
  status: string;
  created_at: string;
}

export default function AdminClassesClient({
  isAdmin,
  courses,
  instructors,
}: {
  isAdmin: boolean;
  courses: Course[];
  instructors: Instructor[];
}) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [examsFor, setExamsFor] = useState<string | null>(null);
  const [nasbaOnly, setNasbaOnly] = useState(false);

  const [form, setForm] = useState({
    course_id: "",
    title: "",
    start_date: "",
    end_date: "",
    instructor_id: "",
    max_capacity: "",
    contract_number: "",
    contract_url: "",
    contract_file_name: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/classes${nasbaOnly ? "?nasba=true" : ""}`);
    if (res.ok) setClasses((await res.json()).classes ?? []);
    setLoading(false);
  }, [nasbaOnly]);

  useEffect(() => { load(); }, [load]);

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: form.course_id,
          title: form.title,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          instructor_id: form.instructor_id || null,
          max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
          ...(isAdmin
            ? {
                contract_number: form.contract_number || null,
                contract_url: form.contract_url || null,
                contract_file_name: form.contract_file_name || null,
              }
            : {}),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ course_id: "", title: "", start_date: "", end_date: "", instructor_id: "", max_capacity: "", contract_number: "", contract_url: "", contract_file_name: "" });
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AdminSessionsTabs />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="mt-1 text-sm text-gray-500">Schedule classes and invite participants.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <input type="checkbox" checked={nasbaOnly} onChange={(e) => setNasbaOnly(e.target.checked)} />
            NASBA certified only
          </label>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" /> New Class
          </Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createClass} className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">Course</label>
            <select
              required
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select a course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {courses.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">No instructor-led courses found. Create one first.</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">Class title</label>
            <input
              required
              placeholder="e.g. June 2026 Cohort"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Start date</label>
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">End date</label>
            <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Instructor</label>
            <select value={form.instructor_id} onChange={(e) => setForm({ ...form, instructor_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Unassigned</option>
              {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Max capacity</label>
            <input type="number" min={1} value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          {isAdmin && (
            <>
              <div className="sm:col-span-2 mt-1 flex items-center gap-2 text-xs font-semibold text-gray-500">
                <FileSignature className="h-3.5 w-3.5" /> Contract (admin only)
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Contract number</label>
                <input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} placeholder="e.g. GGS-2026-0142" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Contract file name (optional)</label>
                <input value={form.contract_file_name} onChange={(e) => setForm({ ...form, contract_file_name: e.target.value })} placeholder="e.g. MSA - Acme Corp.pdf" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">SharePoint link to contract</label>
                <input type="url" value={form.contract_url} onChange={(e) => setForm({ ...form, contract_url: e.target.value })} placeholder="https://yourorg.sharepoint.com/sites/.../contract.pdf" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create Class
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-500">
          No classes yet. Create your first class above.
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500">{c.course_title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
                    {c.start_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(c.start_date).toLocaleDateString()}</span>}
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.participant_count} enrolled</span>
                    <span className="capitalize text-gray-400">{c.status.replace("_", " ")}</span>
                    {c.nasba_certified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        NASBA{c.nasba_cpe_credits != null ? ` · ${c.nasba_cpe_credits} CPE` : ""}
                      </span>
                    )}
                    {isAdmin && c.contract_number && (
                      <span className="inline-flex items-center gap-1 text-gray-500"><FileSignature className="h-3.5 w-3.5" />{c.contract_number}</span>
                    )}
                    {isAdmin && c.contract_url && (
                      <a href={c.contract_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700">
                        <ExternalLink className="h-3.5 w-3.5" /> Contract
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setContractFor(contractFor === c.id ? null : c.id)}
                    >
                      <FileSignature className="h-3.5 w-3.5" /> Contract
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExamsFor(examsFor === c.id ? null : c.id)}
                  >
                    <FileQuestion className="h-3.5 w-3.5" /> Exams
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setInviteFor(inviteFor === c.id ? null : c.id)}
                  >
                    <Mail className="h-3.5 w-3.5" /> Invite
                  </Button>
                  <Link href={`/learn/classes/${c.id}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <ExternalLink className="h-3.5 w-3.5" /> View
                  </Link>
                </div>
              </div>
              {isAdmin && contractFor === c.id && (
                <ContractPanel klass={c} onClose={() => setContractFor(null)} onSaved={load} />
              )}
              {examsFor === c.id && <ExamsPanel classId={c.id} onClose={() => setExamsFor(null)} />}
              {inviteFor === c.id && <InvitePanel classId={c.id} onClose={() => setInviteFor(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExamsPanel({ classId, onClose }: { classId: string; onClose: () => void }) {
  const [items, setItems] = useState<{ id: string; title: string; status: string; deployed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}/assessments`);
    if (res.ok) setItems((await res.json()).assessments ?? []);
    setLoading(false);
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (assessmentId: string, deployed: boolean) => {
    setBusy(assessmentId);
    try {
      if (deployed) {
        await fetch(`/api/classes/${classId}/assessments?assessment_id=${assessmentId}`, { method: "DELETE" });
      } else {
        await fetch(`/api/classes/${classId}/assessments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessment_id: assessmentId }),
        });
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const anyDeployed = items.some((i) => i.deployed);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <FileQuestion className="h-3.5 w-3.5" /> Exams for this class
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      {loading ? (
        <div className="py-4 text-center text-gray-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="py-2 text-xs text-gray-400">This class's course has no assessments yet.</p>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-gray-500">
            {anyDeployed
              ? "Only the ticked exams are shown to this class."
              : "Nothing deployed — all of the course's exams are shown to this class by default."}
          </p>
          <ul className="space-y-1">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
                <span className="text-gray-700">{a.title} <span className="text-[10px] capitalize text-gray-400">· {a.status}</span></span>
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={a.deployed}
                    disabled={busy === a.id}
                    onChange={() => toggle(a.id, a.deployed)}
                  />
                  Deploy
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ContractPanel({
  klass,
  onClose,
  onSaved,
}: {
  klass: ClassRow;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [number, setNumber] = useState(klass.contract_number ?? "");
  const [url, setUrl] = useState(klass.contract_url ?? "");
  const [fileName, setFileName] = useState(klass.contract_file_name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${klass.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_number: number || null,
          contract_url: url || null,
          contract_file_name: fileName || null,
        }),
      });
      if (res.ok) {
        await onSaved();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save contract.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <FileSignature className="h-3.5 w-3.5" /> Contract (admin only)
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Contract number" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="File name (optional)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="SharePoint link to contract" className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save contract
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function InvitePanel({ classId, onClose }: { classId: string; onClose: () => void }) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("learner");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const loadInvites = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}/invite`);
    if (res.ok) setInvitations((await res.json()).invitations ?? []);
  }, [classId]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  const send = async () => {
    const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    if (list.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/classes/${classId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: list, role }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Invited ${data.invited}, skipped ${data.skipped}.`);
        setEmails("");
        await loadInvites();
      } else {
        setResult(data.error || "Failed to send invitations.");
      }
    } finally {
      setSending(false);
    }
  };

  const revoke = async (id: string) => {
    await fetch(`/api/classes/${classId}/invite?id=${id}`, { method: "DELETE" });
    await loadInvites();
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Invite participants</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <textarea
        rows={2}
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="Paste emails separated by commas, spaces, or new lines"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs">
          <option value="learner">Learner</option>
          <option value="instructor">Instructor</option>
          <option value="observer">Observer</option>
        </select>
        <button onClick={send} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Send invitations
        </button>
        {result && <span className="text-xs text-gray-500">{result}</span>}
      </div>

      {invitations.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-200 border-t border-gray-200 pt-2">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-gray-600">{inv.email} · <span className="capitalize text-gray-400">{inv.invited_role}</span></span>
              <span className="flex items-center gap-2">
                <span className={`capitalize ${inv.status === "accepted" ? "text-green-600" : inv.status === "pending" ? "text-amber-600" : "text-gray-400"}`}>{inv.status}</span>
                {inv.status === "pending" && (
                  <button onClick={() => revoke(inv.id)} className="text-red-500 hover:text-red-600">Revoke</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
