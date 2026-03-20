"use client";

import { useState } from "react";
import { type BlockType, blockTypesMeta, type BlockTypeMeta } from "@/lib/content/block-editor";

interface BlockTypePickerProps {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

const categoryLabels: Record<string, string> = {
  basic: "Basic",
  media: "Media",
  interactive: "Interactive",
  layout: "Layout",
};

const iconMap: Record<string, React.ReactNode> = {
  Type: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  Heading: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8" />
    </svg>
  ),
  Minus: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  ),
  AlertCircle: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
    </svg>
  ),
  Image: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 15-5-5L5 21" />
    </svg>
  ),
  Play: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Code: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  ),
  Globe: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  HelpCircle: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01" />
    </svg>
  ),
  ChevronDown: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  ),
  Columns: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18" />
    </svg>
  ),
};

function BlockIcon({ name }: { name: string }) {
  return iconMap[name] || <span className="w-6 h-6 inline-block" />;
}

const categories = ["basic", "media", "interactive", "layout"] as const;

export default function BlockTypePicker({ onSelect, onClose }: BlockTypePickerProps) {
  const [search, setSearch] = useState("");

  const filtered = blockTypesMeta.filter(
    (b) =>
      b.label.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = categories
    .map((cat) => ({
      category: cat,
      label: categoryLabels[cat],
      items: filtered.filter((b) => b.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Add Block</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            placeholder="Search blocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Block grid */}
        <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto">
          {grouped.map((group) => (
            <div key={group.category} className="mb-4 last:mb-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((meta) => (
                  <button
                    key={meta.type}
                    onClick={() => {
                      onSelect(meta.type);
                      onClose();
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-left group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-indigo-100 flex items-center justify-center text-gray-500 group-hover:text-indigo-600 transition-colors">
                      <BlockIcon name={meta.icon} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                      <p className="text-xs text-gray-500 truncate">{meta.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No blocks match your search</p>
          )}
        </div>
      </div>
    </div>
  );
}
