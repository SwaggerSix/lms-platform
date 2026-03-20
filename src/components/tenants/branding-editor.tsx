"use client";

import { useState } from "react";

interface BrandingData {
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  loginBg: string;
  heroText: string;
  footerText: string;
  customCss: string;
}

interface BrandingEditorProps {
  tenantId: string;
  initialBranding: BrandingData;
}

export function BrandingEditor({ tenantId, initialBranding }: BrandingEditorProps) {
  const [branding, setBranding] = useState<BrandingData>(initialBranding);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const update = (field: keyof BrandingData, value: string) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: branding.logoUrl || null,
          favicon_url: branding.faviconUrl || null,
          primary_color: branding.primaryColor,
          secondary_color: branding.secondaryColor,
          branding: {
            login_bg: branding.loginBg || undefined,
            hero_text: branding.heroText || undefined,
            footer_text: branding.footerText || undefined,
            custom_css: branding.customCss || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: "success", text: "Branding saved successfully" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Editor Panel */}
      <div className="space-y-6">
        {message && (
          <div className={`px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {message.text}
          </div>
        )}

        {/* Logo & Favicon */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Logo & Favicon</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Logo URL</label>
            <input
              type="url"
              value={branding.logoUrl || ""}
              onChange={(e) => update("logoUrl", e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Favicon URL</label>
            <input
              type="url"
              value={branding.faviconUrl || ""}
              onChange={(e) => update("faviconUrl", e.target.value)}
              placeholder="https://example.com/favicon.ico"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Colors */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Colors</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Primary</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Secondary</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) => update("secondaryColor", e.target.value)}
                  className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.secondaryColor}
                  onChange={(e) => update("secondaryColor", e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Content</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hero Text</label>
            <input
              type="text"
              value={branding.heroText}
              onChange={(e) => update("heroText", e.target.value)}
              placeholder="Welcome to our learning platform"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Footer Text</label>
            <input
              type="text"
              value={branding.footerText}
              onChange={(e) => update("footerText", e.target.value)}
              placeholder="2026 Company Name. All rights reserved."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Login Background URL</label>
            <input
              type="url"
              value={branding.loginBg}
              onChange={(e) => update("loginBg", e.target.value)}
              placeholder="https://example.com/bg.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Custom CSS */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Custom CSS</h3>
          <textarea
            value={branding.customCss}
            onChange={(e) => update("customCss", e.target.value)}
            placeholder=".custom-class { color: red; }"
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Branding"}
        </button>
      </div>

      {/* Live Preview */}
      <div className="sticky top-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500">Live Preview</p>
          </div>

          {/* Simulated Portal */}
          <div className="bg-gray-100">
            {/* Nav Bar */}
            <div
              className="h-14 flex items-center px-5 gap-3"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto rounded" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white text-sm font-bold">
                  {branding.name?.charAt(0)?.toUpperCase() || "T"}
                </div>
              )}
              <span className="text-white text-sm font-medium">{branding.name || "Tenant"}</span>
              <div className="flex-1" />
              <div className="flex gap-4">
                {["Courses", "Dashboard", "Profile"].map((item) => (
                  <span key={item} className="text-white/70 text-xs">{item}</span>
                ))}
              </div>
            </div>

            {/* Hero Section */}
            <div
              className="px-5 py-8 text-center"
              style={{
                backgroundImage: branding.loginBg ? `url(${branding.loginBg})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: branding.loginBg ? undefined : `${branding.primaryColor}10`,
              }}
            >
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                {branding.heroText || "Welcome to the learning platform"}
              </h2>
              <p className="text-xs text-gray-500 mb-4">Explore courses and track your progress</p>
              <button
                className="px-4 py-2 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Browse Courses
              </button>
            </div>

            {/* Course Cards */}
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-lg overflow-hidden shadow-sm">
                    <div
                      className="h-16"
                      style={{
                        background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
                      }}
                    />
                    <div className="p-3">
                      <div className="h-2.5 w-3/4 bg-gray-200 rounded mb-1.5" />
                      <div className="h-2 w-1/2 bg-gray-100 rounded mb-2" />
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          background: `linear-gradient(to right, ${branding.primaryColor} ${30 + i * 20}%, #e5e7eb ${30 + i * 20}%)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-white">
              <p className="text-[10px] text-gray-400 text-center">
                {branding.footerText || `${new Date().getFullYear()} ${branding.name || "Tenant"}. All rights reserved.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
