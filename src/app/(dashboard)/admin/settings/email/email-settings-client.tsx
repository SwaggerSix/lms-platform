"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, CheckCircle2, AlertTriangle, Send } from "lucide-react";

export default function EmailSettingsClient() {
  const [from, setFrom] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [source, setSource] = useState<"app" | "env" | "none">("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/email-settings");
      if (res.ok) {
        const d = await res.json();
        setFrom(d.from ?? "");
        setHasKey(!!d.has_key);
        setSource(d.source ?? "none");
        setApiKey(d.api_key_masked ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, string> = { from };
      // Only send the key if the admin typed a new one (not the mask).
      if (apiKey && !apiKey.includes("•")) payload.api_key = apiKey;
      const res = await fetch("/api/admin/email-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save");
      setHasKey(!!d.has_key);
      setSource(d.source ?? "none");
      if (payload.api_key) setApiKey("••••••••");
      setMsg({ kind: "ok", text: "Saved." });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message ?? "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/email-settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Test failed");
      setMsg({ kind: "ok", text: `Test email sent to ${d.to}. Check the inbox.` });
    } catch (e: any) {
      setMsg({ kind: "err", text: `Test failed: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Mail className="h-6 w-6 text-indigo-600" /> Email Settings</h1>
      <p className="mt-1 text-sm text-gray-500">Transactional email is sent via Resend. Configure your sending address and API key here.</p>

      <div className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${hasKey ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
        {hasKey ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {hasKey
          ? `Email delivery is configured (${source === "app" ? "key set here" : "from environment"}).`
          : "Email delivery is not configured yet — add a Resend API key below."}
      </div>

      <div className="mt-6 space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">From address</label>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="LearnHub <noreply@yourverifieddomain.com>"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">Must use a domain you've verified in Resend.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Resend API key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="re_..."
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">Stored encrypted. Leave the dots unchanged to keep the existing key. Get a key at resend.com/api-keys.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
          <button onClick={sendTest} disabled={testing || !hasKey} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test email
          </button>
        </div>
        {msg && (
          <p className={`text-sm ${msg.kind === "ok" ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-semibold text-gray-800">Setting up Resend</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Create an account at resend.com.</li>
          <li>Add &amp; verify your sending domain (Domains → add DNS records).</li>
          <li>Create an API key (API Keys → Create).</li>
          <li>Paste the key above and set the From address to that domain, then Save and Send a test.</li>
        </ol>
      </div>
    </div>
  );
}
