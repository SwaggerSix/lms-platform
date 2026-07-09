"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Award } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface Cert {
  id: string;
  name: string;
  credential_type: string;
  license_number: string | null;
  issuing_body: string | null;
  issuing_state: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
}

const EMPTY = {
  id: "", name: "", credential_type: "nasba", license_number: "", issuing_body: "",
  issuing_state: "", issued_date: "", expiry_date: "", status: "active", notes: "",
};

function expiryState(expiry: string | null): { label: string; cls: string } | null {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Expired", cls: "bg-red-100 text-red-700" };
  if (days <= 60) return { label: `Expires in ${days}d`, cls: "bg-amber-100 text-amber-700" };
  return { label: "Valid", cls: "bg-green-100 text-green-700" };
}

export default function CertificationsClient() {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/instructor-certifications");
    if (res.ok) setCerts((await res.json()).certifications ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ ...EMPTY }); setShowForm(true); };
  const openEdit = (c: Cert) => {
    setForm({
      id: c.id, name: c.name, credential_type: c.credential_type, license_number: c.license_number ?? "",
      issuing_body: c.issuing_body ?? "", issuing_state: c.issuing_state ?? "",
      issued_date: c.issued_date ?? "", expiry_date: c.expiry_date ?? "", status: c.status, notes: c.notes ?? "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch("/api/instructor-certifications", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: form.id || undefined }),
      });
      if (res.ok) { setShowForm(false); await load(); }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/instructor-certifications?id=${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Certifications</h1>
          <p className="mt-1 text-sm text-gray-500">Track your NASBA and other professional credentials.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          <Plus className="h-4 w-4" /> Add certification
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : certs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Award className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No certifications recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((c) => {
            const ex = expiryState(c.expiry_date);
            return (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-gray-900">
                    {c.name}
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">{c.credential_type}</span>
                    {ex && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ex.cls}`}>{ex.label}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                    {c.license_number && <span>License: {c.license_number}</span>}
                    {c.issuing_body && <span>{c.issuing_body}{c.issuing_state ? ` (${c.issuing_state})` : ""}</span>}
                    {c.issued_date && <span>Issued {new Date(c.issued_date).toLocaleDateString()}</span>}
                    {c.expiry_date && <span>Expires {new Date(c.expiry_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openEdit(c)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(c.id)} className="rounded p-1.5 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal
          isOpen
          onClose={() => setShowForm(false)}
          title={`${form.id ? "Edit" : "Add"} certification`}
          size="md"
          footer={
            <>
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </>
          }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Credential name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. NASBA CPE Sponsor — CPA" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
                <select value={form.credential_type} onChange={(e) => setForm({ ...form, credential_type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="nasba">NASBA</option>
                  <option value="cpa">CPA</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">License / registry #</label>
                <input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Issuing body</label>
                <input value={form.issuing_body} onChange={(e) => setForm({ ...form, issuing_body: e.target.value })} placeholder="e.g. NASBA / State Board" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Issuing state</label>
                <input value={form.issuing_state} onChange={(e) => setForm({ ...form, issuing_state: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Issued date</label>
                <input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Expiry date</label>
                <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
        </Modal>
      )}
    </div>
  );
}
