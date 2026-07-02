"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

// Inline "Request pricing & availability" inquiry form. Replaces the old
// mailto: link, which did nothing for visitors without a desktop mail client.
export function RequestPricing({
  slug,
  productId,
  productName,
}: {
  slug: string;
  productId: string;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    phone: "",
    seats_estimate: "",
    message: "",
    website: "", // honeypot
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/storefront/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storefront_slug: slug,
          product_id: productId,
          name: form.name,
          email: form.email,
          organization: form.organization || undefined,
          phone: form.phone || undefined,
          seats_estimate: form.seats_estimate || undefined,
          message: form.message || undefined,
          website: form.website || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <h3 className="text-sm font-bold text-green-800">Request sent</h3>
        </div>
        <p className="mt-1 text-sm text-green-700">
          Thanks, {form.name.split(" ")[0] || "there"} — our team will get back to you shortly about{" "}
          <span className="font-semibold">{productName}</span>.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-white font-semibold text-base hover:opacity-90 transition-opacity"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        <Mail className="h-4 w-4" /> Request pricing &amp; availability
      </button>
    );
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">
          Request pricing &amp; availability
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
        <input
          required
          value={form.name}
          onChange={set("name")}
          placeholder="Your name *"
          autoComplete="name"
          className={input}
          style={{ ["--tw-ring-color" as string]: "var(--store-primary)" }}
        />
        <input
          required
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="Work email *"
          autoComplete="email"
          className={input}
          style={{ ["--tw-ring-color" as string]: "var(--store-primary)" }}
        />
        <input
          value={form.organization}
          onChange={set("organization")}
          placeholder="Organization / agency"
          autoComplete="organization"
          className={input}
          style={{ ["--tw-ring-color" as string]: "var(--store-primary)" }}
        />
        <input
          value={form.phone}
          onChange={set("phone")}
          placeholder="Phone"
          autoComplete="tel"
          className={input}
          style={{ ["--tw-ring-color" as string]: "var(--store-primary)" }}
        />
        <input
          value={form.seats_estimate}
          onChange={set("seats_estimate")}
          placeholder="Estimated participants (e.g. 25)"
          className={`${input} sm:col-span-2`}
          style={{ ["--tw-ring-color" as string]: "var(--store-primary)" }}
        />
        <textarea
          value={form.message}
          onChange={set("message")}
          placeholder="Anything else we should know? Preferred dates, delivery format, location…"
          rows={3}
          className={`${input} sm:col-span-2 resize-y`}
          style={{ ["--tw-ring-color" as string]: "var(--store-primary)" }}
        />
        {/* Honeypot — hidden from real users */}
        <input
          type="text"
          value={form.website}
          onChange={set("website")}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Send request
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
