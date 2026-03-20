"use client";

import { useState } from "react";

interface ProviderSetupProps {
  onSuccess?: (provider: any) => void;
  onCancel?: () => void;
}

const providerTypes = [
  {
    value: "linkedin_learning",
    name: "LinkedIn Learning",
    logo: "🔵",
    color: "from-blue-600 to-blue-800",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", required: true },
      { key: "organization_id", label: "Organization ID", type: "text", required: true },
    ],
  },
  {
    value: "coursera",
    name: "Coursera",
    logo: "🟦",
    color: "from-blue-500 to-indigo-600",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "business_id", label: "Business ID", type: "text", required: true },
      { key: "base_url", label: "API Base URL", type: "text", required: false },
    ],
  },
  {
    value: "udemy_business",
    name: "Udemy Business",
    logo: "🟣",
    color: "from-purple-600 to-violet-700",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", required: true },
      { key: "account_id", label: "Account ID", type: "text", required: true },
    ],
  },
  {
    value: "openai",
    name: "OpenAI",
    logo: "🤖",
    color: "from-gray-800 to-gray-900",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "model", label: "Model (e.g., gpt-4)", type: "text", required: false },
    ],
  },
  {
    value: "custom",
    name: "Custom Provider",
    logo: "⚙️",
    color: "from-gray-500 to-gray-700",
    fields: [
      { key: "api_url", label: "API URL", type: "text", required: true },
      { key: "api_key", label: "API Key", type: "password", required: false },
      { key: "auth_header", label: "Auth Header Name", type: "text", required: false },
    ],
  },
];

export default function ProviderSetup({ onSuccess, onCancel }: ProviderSetupProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [apiConfig, setApiConfig] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProvider = providerTypes.find((p) => p.value === selectedType);

  const handleFieldChange = (key: string, value: string) => {
    setApiConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedType || !name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/marketplace/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          provider_type: selectedType,
          api_config: apiConfig,
          is_active: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create provider");
      }

      const data = await res.json();
      onSuccess?.(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Progress Steps */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-8">
          {[
            { num: 1, label: "Select Provider" },
            { num: 2, label: "Configure" },
            { num: 3, label: "Review" },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step >= s.num
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {step > s.num ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span className={`text-sm font-medium ${step >= s.num ? "text-gray-900" : "text-gray-400"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Step 1: Select Provider */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Choose a content provider to integrate with your LMS.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {providerTypes.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setSelectedType(p.value);
                    setName(p.name);
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedType === p.value
                      ? "border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-lg mb-3`}>
                    {p.logo}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.fields.length} configuration fields</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              {onCancel && (
                <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Cancel
                </button>
              )}
              <button
                onClick={() => selectedType && setStep(2)}
                disabled={!selectedType}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && selectedProvider && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter the API credentials for <strong>{selectedProvider.name}</strong>.
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="My LinkedIn Learning"
              />
            </div>
            {selectedProvider.fields.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type={field.type}
                  value={apiConfig[field.key] || ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required={field.required}
                />
              </div>
            ))}
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Review
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && selectedProvider && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Review your provider configuration before saving.</p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedProvider.color} flex items-center justify-center text-lg`}>
                  {selectedProvider.logo}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-500">{selectedProvider.name}</p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-3 space-y-2">
                {selectedProvider.fields.map((field) => (
                  <div key={field.key} className="flex justify-between">
                    <span className="text-xs text-gray-500">{field.label}</span>
                    <span className="text-xs font-mono text-gray-700">
                      {field.type === "password"
                        ? (apiConfig[field.key] ? "****" + apiConfig[field.key].slice(-4) : "Not set")
                        : (apiConfig[field.key] || "Not set")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs text-amber-600">
                  The provider will be created in inactive state. You can activate it after verifying the credentials.
                </p>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Creating..." : "Create Provider"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
