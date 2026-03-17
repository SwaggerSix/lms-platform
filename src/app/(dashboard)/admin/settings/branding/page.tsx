"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import { useBrandingStore } from "@/stores/branding-store";
import { brandPresets, defaultBranding, type BrandingConfig } from "@/lib/branding";
import NextImage from "next/image";
import {
  Save,
  RotateCcw,
  Palette,
  Type,
  Image,
  Monitor,
  GraduationCap,
  Check,
} from "lucide-react";

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded border border-gray-300 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-24 rounded-md border border-gray-300 bg-white px-3 text-sm font-mono text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}

export default function BrandingSettingsPage() {
  const { config, setConfig, resetConfig } = useBrandingStore();
  const [draft, setDraft] = useState<BrandingConfig>(config);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "colors" | "login" | "preview">("general");

  const update = (partial: Partial<BrandingConfig>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = () => {
    setConfig(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setDraft(defaultBranding);
    resetConfig();
  };

  const applyPreset = (presetKey: string) => {
    const preset = brandPresets[presetKey];
    if (preset) {
      update(preset);
    }
  };

  const tabs = [
    { key: "general" as const, label: "General", icon: Type },
    { key: "colors" as const, label: "Colors & Theme", icon: Palette },
    { key: "login" as const, label: "Login Page", icon: Monitor },
    { key: "preview" as const, label: "Preview", icon: Image },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portal Branding</h1>
          <p className="mt-1 text-sm text-gray-500">
            Customize the look and feel of your learning portal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ backgroundColor: draft.primaryColor }}
          >
            {saved ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" aria-label="Branding settings">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Portal Name
            </label>
            <input
              type="text"
              value={draft.portalName}
              onChange={(e) => update({ portalName: e.target.value })}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Displayed in the sidebar, browser tab, and login page
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tagline
            </label>
            <input
              type="text"
              value={draft.tagline}
              onChange={(e) => update({ tagline: e.target.value })}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Logo URL
            </label>
            <input
              type="url"
              value={draft.logoUrl || ""}
              onChange={(e) => update({ logoUrl: e.target.value || null })}
              placeholder="https://example.com/logo.png"
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Recommended: 200x40px PNG or SVG with transparent background
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Support Email
            </label>
            <input
              type="email"
              value={draft.supportEmail}
              onChange={(e) => update({ supportEmail: e.target.value })}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Footer Text
            </label>
            <input
              type="text"
              value={draft.footerText}
              onChange={(e) => update({ footerText: e.target.value })}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use {"{year}"} as a placeholder for the current year
            </p>
          </div>
        </div>
      )}

      {/* Colors Tab */}
      {activeTab === "colors" && (
        <div className="space-y-6">
          {/* Preset Themes */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Quick Presets</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(brandPresets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
                    draft.primaryColor === preset.primaryColor
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Colors */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Primary Brand Colors</h3>
            <div className="grid grid-cols-2 gap-6">
              <ColorInput
                label="Primary Color"
                value={draft.primaryColor}
                onChange={(v) => update({ primaryColor: v })}
              />
              <ColorInput
                label="Primary Hover"
                value={draft.primaryHoverColor}
                onChange={(v) => update({ primaryHoverColor: v })}
              />
              <ColorInput
                label="Primary Light (Backgrounds)"
                value={draft.primaryLightColor}
                onChange={(v) => update({ primaryLightColor: v })}
              />
              <ColorInput
                label="Primary Text"
                value={draft.primaryTextColor}
                onChange={(v) => update({ primaryTextColor: v })}
              />
            </div>
          </div>

          {/* Sidebar Colors */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Sidebar Colors</h3>
            <div className="grid grid-cols-2 gap-6">
              <ColorInput
                label="Background"
                value={draft.sidebarBg}
                onChange={(v) => update({ sidebarBg: v })}
              />
              <ColorInput
                label="Text"
                value={draft.sidebarText}
                onChange={(v) => update({ sidebarText: v })}
              />
              <ColorInput
                label="Active Item Text"
                value={draft.sidebarActiveText}
                onChange={(v) => update({ sidebarActiveText: v })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Login Page Tab */}
      {activeTab === "login" && (
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Background Style
            </label>
            <div className="flex gap-3">
              {(["gradient", "solid", "image"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => update({ loginBgStyle: style })}
                  className={cn(
                    "rounded-lg border-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
                    draft.loginBgStyle === style
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {draft.loginBgStyle === "image" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Background Image URL
              </label>
              <input
                type="url"
                value={draft.loginBgImageUrl || ""}
                onChange={(e) => update({ loginBgImageUrl: e.target.value || null })}
                placeholder="https://example.com/bg.jpg"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {(draft.loginBgStyle === "gradient" || draft.loginBgStyle === "solid") && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Background Color / Gradient
              </label>
              <input
                type="text"
                value={draft.loginBgColor}
                onChange={(e) => update({ loginBgColor: e.target.value })}
                placeholder="linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === "preview" && (
        <div className="space-y-6">
          {/* Sidebar Preview */}
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <h3 className="border-b border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900">
              Sidebar Preview
            </h3>
            <div className="flex h-64">
              <div
                className="flex w-64 flex-col p-4"
                style={{ backgroundColor: draft.sidebarBg }}
              >
                <div className="flex items-center gap-3 mb-6">
                  {draft.logoUrl ? (
                    <NextImage src={draft.logoUrl} alt="Portal logo" width={36} height={36} className="h-9 w-9 rounded-lg object-contain" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: draft.primaryColor }}>
                      <GraduationCap className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <span className="text-lg font-bold text-white">{draft.portalName}</span>
                </div>
                <div className="space-y-1">
                  <div
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                    style={{
                      backgroundColor: draft.sidebarActiveBg,
                      color: draft.sidebarActiveText,
                    }}
                  >
                    <div className="h-4 w-4 rounded bg-current opacity-50" />
                    Dashboard
                  </div>
                  {["Course Catalog", "My Courses", "Learning Paths"].map((label) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                      style={{ color: draft.sidebarText }}
                    >
                      <div className="h-4 w-4 rounded bg-current opacity-30" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-gray-50 p-6">
                <div className="space-y-3">
                  <div className="h-6 w-48 rounded" style={{ backgroundColor: draft.primaryColor, opacity: 0.2 }} />
                  <div className="h-4 w-72 rounded bg-gray-200" />
                  <div className="flex gap-2 mt-4">
                    <button
                      className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                      style={{ backgroundColor: draft.primaryColor }}
                    >
                      Primary Button
                    </button>
                    <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
                      Secondary
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Button Preview */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Button States</h3>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: draft.primaryColor }}
              >
                Default
              </button>
              <button
                className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: draft.primaryHoverColor }}
              >
                Hover
              </button>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium"
                style={{
                  backgroundColor: draft.primaryLightColor,
                  color: draft.primaryTextColor,
                }}
              >
                Badge
              </span>
              <a
                href="#"
                className="text-sm font-medium underline"
                style={{ color: draft.primaryTextColor }}
                onClick={(e) => e.preventDefault()}
              >
                Link Text
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
