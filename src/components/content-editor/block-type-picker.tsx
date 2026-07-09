"use client";

import { useState } from "react";
import { type BlockType, blockTypesMeta, type BlockTypeMeta } from "@/lib/content/block-editor";
import { Type, Heading, Minus, AlertCircle, Image as ImageIcon, Play, Code, Globe, HelpCircle, ChevronDown, Columns2, X } from "lucide-react";

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
  Type: <Type className="w-6 h-6" strokeWidth={1.5} />,
  Heading: <Heading className="w-6 h-6" strokeWidth={1.5} />,
  Minus: <Minus className="w-6 h-6" strokeWidth={1.5} />,
  AlertCircle: <AlertCircle className="w-6 h-6" strokeWidth={1.5} />,
  Image: <ImageIcon className="w-6 h-6" strokeWidth={1.5} />,
  Play: <Play className="w-6 h-6" strokeWidth={1.5} />,
  Code: <Code className="w-6 h-6" strokeWidth={1.5} />,
  Globe: <Globe className="w-6 h-6" strokeWidth={1.5} />,
  HelpCircle: <HelpCircle className="w-6 h-6" strokeWidth={1.5} />,
  ChevronDown: <ChevronDown className="w-6 h-6" strokeWidth={1.5} />,
  Columns: <Columns2 className="w-6 h-6" strokeWidth={1.5} />,
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
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Search blocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 transition-all text-left group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-primary-100 flex items-center justify-center text-gray-500 group-hover:text-primary-600 transition-colors">
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
