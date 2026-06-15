"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Award, Download } from "lucide-react";

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
  user: { first_name: string; last_name: string; email: string } | { first_name: string; last_name: string; email: string }[] | null;
}

function expiry(expiry: string | null): { label: string; cls: string; bucket: string } {
  if (!expiry) return { label: "No expiry", cls: "text-gray-400", bucket: "none" };
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Expired", cls: "text-red-600", bucket: "expired" };
  if (days <= 60) return { label: `${days}d left`, cls: "text-amber-600", bucket: "expiring" };
  return { label: "Valid", cls: "text-green-600", bucket: "valid" };
}

export default function AdminCertsClient() {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/instructor-certifications?scope=all");
    if (res.ok) setCerts((await res.json()).certifications ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => certs.map((c) => {
    const u = Array.isArray(c.user) ? c.user[0] : c.user;
    return { ...c, instructor: u ? `${u.first_name} ${u.last_name}` : "—", email: u?.email ?? "", ex: expiry(c.expiry_date) };
  }), [certs]);

  const filtered = rows.filter((r) => filter === "all" || r.ex.bucket === filter);

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Instructor", "Email", "Credential", "Type", "License", "Issuing body", "State", "Issued", "Expires", "Status"];
    const lines = [header.map(esc).join(","), ...filtered.map((r) => [
      r.instructor, r.email, r.name, r.credential_type, r.license_number ?? "", r.issuing_body ?? "",
      r.issuing_state ?? "", r.issued_date ?? "", r.expiry_date ?? "", r.status,
    ].map((v) => esc(String(v))).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `instructor-certifications-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => ({
    expiring: rows.filter((r) => r.ex.bucket === "expiring").length,
    expired: rows.filter((r) => r.ex.bucket === "expired").length,
  }), [rows]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instructor Certifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            NASBA and professional credentials across instructors.
            {counts.expired > 0 && <span className="ml-1 text-red-600">{counts.expired} expired.</span>}
            {counts.expiring > 0 && <span className="ml-1 text-amber-600">{counts.expiring} expiring soon.</span>}
          </p>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "expiring", "expired"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${filter === f ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{f}</button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400"><Award className="mx-auto mb-2 h-8 w-8 text-gray-300" />No certifications match.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3">Credential</th>
                <th className="px-4 py-3">License</th>
                <th className="px-4 py-3">Issuing</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.instructor}</p>
                    <p className="text-xs text-gray-400">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.name}<span className="ml-1 text-[10px] uppercase text-gray-400">{r.credential_type}</span></td>
                  <td className="px-4 py-3 text-gray-500">{r.license_number ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{r.issuing_body ?? "—"}{r.issuing_state ? ` (${r.issuing_state})` : ""}</td>
                  <td className="px-4 py-3">
                    <span className={r.ex.cls}>{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : "—"}</span>
                    <span className={`ml-1 text-xs ${r.ex.cls}`}>· {r.ex.label}</span>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
