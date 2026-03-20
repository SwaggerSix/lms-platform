"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = 1 | 2 | 3;

export default function CreateTenantWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    domain: "",
    plan: "starter",
    primary_color: "#4f46e5",
    secondary_color: "#7c3aed",
    max_users: "",
    max_courses: "",
  });

  const updateForm = (updates: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 63);
  };

  const handleNameChange = (name: string) => {
    updateForm({ name, slug: generateSlug(name) });
  };

  const canProceed = () => {
    if (step === 1) return form.name.trim().length > 0 && form.slug.trim().length >= 2;
    if (step === 2) return true;
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
        plan: form.plan,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      };
      if (form.domain) payload.domain = form.domain;
      if (form.max_users) payload.max_users = Number(form.max_users);
      if (form.max_courses) payload.max_courses = Number(form.max_courses);

      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create tenant");
      router.push(`/admin/tenants/${data.tenant.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const STEPS = [
    { num: 1, label: "Basics" },
    { num: 2, label: "Plan & Limits" },
    { num: 3, label: "Branding" },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/tenants" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Tenant</h1>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s.num
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {step > s.num ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s.num
              )}
            </div>
            <span className={`text-sm ${step >= s.num ? "text-indigo-600 font-medium" : "text-gray-500"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-12 h-px bg-gray-300 mx-2" />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Basics */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tenant Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Corporation"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={form.slug}
                onChange={(e) => updateForm({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                placeholder="acme-corp"
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-l-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="px-3 py-2.5 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-sm text-gray-500">
                .lms-platform.com
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Lowercase letters, numbers, and hyphens only. At least 2 characters.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Domain (optional)</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => updateForm({ domain: e.target.value })}
              placeholder="learn.acme.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Point a CNAME record to your platform to use a custom domain.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Plan & Limits */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Plan</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "free", label: "Free", desc: "10 users, 3 courses", price: "$0/mo" },
                { key: "starter", label: "Starter", desc: "50 users, 20 courses", price: "$49/mo" },
                { key: "professional", label: "Professional", desc: "500 users, 100 courses", price: "$199/mo" },
                { key: "enterprise", label: "Enterprise", desc: "Unlimited", price: "Custom" },
              ].map((plan) => (
                <button
                  key={plan.key}
                  onClick={() => updateForm({ plan: plan.key })}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${
                    form.plan === plan.key
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{plan.label}</p>
                    <p className="text-sm font-semibold text-indigo-600">{plan.price}</p>
                  </div>
                  <p className="text-xs text-gray-500">{plan.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Users Override
              </label>
              <input
                type="number"
                value={form.max_users}
                onChange={(e) => updateForm({ max_users: e.target.value })}
                placeholder="Use plan default"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Courses Override
              </label>
              <input
                type="number"
                value={form.max_courses}
                onChange={(e) => updateForm({ max_courses: e.target.value })}
                placeholder="Use plan default"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Branding */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => updateForm({ primary_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.primary_color}
                  onChange={(e) => updateForm({ primary_color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.secondary_color}
                  onChange={(e) => updateForm({ secondary_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.secondary_color}
                  onChange={(e) => updateForm({ secondary_color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-12 flex items-center px-4 gap-3" style={{ backgroundColor: form.primary_color }}>
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                  {form.name?.charAt(0)?.toUpperCase() || "T"}
                </div>
                <span className="text-white text-sm font-medium">{form.name || "Tenant Name"}</span>
              </div>
              <div className="p-6 bg-gray-50">
                <div className="flex gap-3 mb-4">
                  <div className="h-8 w-24 rounded-lg" style={{ backgroundColor: form.primary_color, opacity: 0.1 }} />
                  <div className="h-8 w-20 rounded-lg" style={{ backgroundColor: form.secondary_color, opacity: 0.15 }} />
                </div>
                <div className="h-3 w-3/4 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-1/2 bg-gray-200 rounded mb-4" />
                <button
                  className="px-4 py-1.5 rounded-lg text-white text-xs"
                  style={{ backgroundColor: form.primary_color }}
                >
                  Button Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={!canProceed()}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={creating || !canProceed()}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Tenant"}
          </button>
        )}
      </div>
    </div>
  );
}
