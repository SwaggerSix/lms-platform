"use client";

import { useState } from "react";

interface XRUploadProps {
  onSuccess?: (content: any) => void;
}

const contentTypes = [
  { value: "vr_360", label: "360 VR Video", description: "Panoramic 360-degree video content" },
  { value: "vr_interactive", label: "Interactive VR", description: "Full interactive VR environment" },
  { value: "ar_overlay", label: "AR Overlay", description: "Augmented reality overlay content" },
  { value: "3d_model", label: "3D Model", description: "Interactive 3D model viewer" },
];

const compatibilityOptions = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "headset", label: "VR Headset" },
];

export default function XRUpload({ onSuccess }: XRUploadProps) {
  const [form, setForm] = useState({
    content_type: "vr_360",
    file_url: "",
    fallback_url: "",
    lesson_id: "",
    resolution: "",
    format: "",
    file_size: "",
    poly_count: "",
    auto_play: false,
    controls: true,
    initial_view: "0,0",
    compatibility: ["desktop", "mobile", "headset"],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCompatibility = (value: string) => {
    setForm((prev) => ({
      ...prev,
      compatibility: prev.compatibility.includes(value)
        ? prev.compatibility.filter((c) => c !== value)
        : [...prev.compatibility, value],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file_url) {
      setError("File URL is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        content_type: form.content_type,
        file_url: form.file_url,
        fallback_url: form.fallback_url || null,
        lesson_id: form.lesson_id || null,
        metadata: {
          resolution: form.resolution || null,
          format: form.format || null,
          file_size: form.file_size || null,
          poly_count: form.poly_count ? parseInt(form.poly_count) : null,
        },
        player_config: {
          auto_play: form.auto_play,
          controls: form.controls,
          initial_view: form.initial_view,
        },
        compatibility: form.compatibility,
      };

      const res = await fetch("/api/xr/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create XR content");
      }

      const data = await res.json();
      onSuccess?.(data);

      // Reset form
      setForm({
        content_type: "vr_360",
        file_url: "",
        fallback_url: "",
        lesson_id: "",
        resolution: "",
        format: "",
        file_size: "",
        poly_count: "",
        auto_play: false,
        controls: true,
        initial_view: "0,0",
        compatibility: ["desktop", "mobile", "headset"],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Upload XR Content</h3>
        <p className="text-xs text-gray-500 mt-0.5">Add VR, AR, or 3D content to your lessons.</p>
      </div>

      <div className="p-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Content Type */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Content Type</label>
          <div className="grid grid-cols-2 gap-2">
            {contentTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, content_type: type.value }))}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  form.content_type === type.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className={`text-sm font-medium ${form.content_type === type.value ? "text-indigo-700" : "text-gray-700"}`}>
                  {type.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* URLs */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Content URL *</label>
            <input
              type="url"
              value={form.file_url}
              onChange={(e) => setForm((prev) => ({ ...prev, file_url: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="https://storage.example.com/vr-content/scene.html"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Fallback URL (non-VR devices)</label>
            <input
              type="url"
              value={form.fallback_url}
              onChange={(e) => setForm((prev) => ({ ...prev, fallback_url: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="https://storage.example.com/vr-content/fallback.mp4"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Lesson ID (optional)</label>
            <input
              type="text"
              value={form.lesson_id}
              onChange={(e) => setForm((prev) => ({ ...prev, lesson_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="UUID of the lesson to attach to"
            />
          </div>
        </div>

        {/* Metadata */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Metadata</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={form.resolution}
              onChange={(e) => setForm((prev) => ({ ...prev, resolution: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Resolution (e.g., 4096x2048)"
            />
            <input
              type="text"
              value={form.format}
              onChange={(e) => setForm((prev) => ({ ...prev, format: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Format (e.g., gltf, mp4)"
            />
            <input
              type="text"
              value={form.file_size}
              onChange={(e) => setForm((prev) => ({ ...prev, file_size: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="File size (e.g., 156MB)"
            />
            <input
              type="text"
              value={form.poly_count}
              onChange={(e) => setForm((prev) => ({ ...prev, poly_count: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Poly count (3D models)"
            />
          </div>
        </div>

        {/* Player Config */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Player Settings</label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_play}
                onChange={(e) => setForm((prev) => ({ ...prev, auto_play: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Auto-play</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.controls}
                onChange={(e) => setForm((prev) => ({ ...prev, controls: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Show controls</span>
            </label>
          </div>
        </div>

        {/* Compatibility */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Device Compatibility</label>
          <div className="flex items-center gap-3">
            {compatibilityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleCompatibility(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.compatibility.includes(opt.value)
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create XR Content"}
        </button>
      </div>
    </form>
  );
}
