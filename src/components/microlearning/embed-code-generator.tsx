"use client";

import { useState } from "react";

interface Widget {
  id: string;
  name: string;
  widget_type: string;
  embed_token: string;
  is_active: boolean;
}

interface EmbedCodeGeneratorProps {
  widget: Widget;
  baseUrl?: string;
}

export default function EmbedCodeGenerator({ widget, baseUrl }: EmbedCodeGeneratorProps) {
  const [embedType, setEmbedType] = useState<"iframe" | "script">("iframe");
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("400");
  const [copied, setCopied] = useState(false);

  const origin = baseUrl || (typeof window !== "undefined" ? window.location.origin : "https://your-domain.com");
  const embedUrl = `${origin}/embed/${widget.embed_token}`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}px"
  frameborder="0"
  style="border: none; border-radius: 8px; overflow: hidden;"
  title="${widget.name}"
  loading="lazy"
></iframe>`;

  const scriptCode = `<div id="lms-widget-${widget.embed_token}" data-widget-token="${widget.embed_token}"></div>
<script>
(function() {
  var container = document.getElementById('lms-widget-${widget.embed_token}');
  var iframe = document.createElement('iframe');
  iframe.src = '${embedUrl}';
  iframe.style.width = '${width}';
  iframe.style.height = '${height}px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  iframe.title = '${widget.name}';
  iframe.loading = 'lazy';
  container.appendChild(iframe);
})();
</script>`;

  const code = embedType === "iframe" ? iframeCode : scriptCode;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Embed Code</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Copy and paste this code into your website to embed the <strong>{widget.name}</strong> widget.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Embed Type Toggle */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Embed Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setEmbedType("iframe")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                embedType === "iframe"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              iFrame
            </button>
            <button
              onClick={() => setEmbedType("script")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                embedType === "script"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              JavaScript
            </button>
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Width</label>
            <input
              type="text"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="100% or 600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Height (px)</label>
            <input
              type="text"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="400"
            />
          </div>
        </div>

        {/* Code Preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-700">Code</label>
            <button
              onClick={handleCopy}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                copied
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>

        {/* Preview */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Preview</label>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <iframe
              src={embedUrl}
              width={width}
              height={`${height}px`}
              style={{ border: "none", borderRadius: "8px", maxWidth: "100%" }}
              title={`Preview: ${widget.name}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
