"use client";

import { type ContentBlock, type BlockType } from "@/lib/content/block-editor";

interface BlockToolbarProps {
  block: ContentBlock;
  index: number;
  totalBlocks: number;
  onUpdate: (block: ContentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export default function BlockToolbar({
  block,
  index,
  totalBlocks,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: BlockToolbarProps) {
  const updateSettings = (key: string, value: string) => {
    onUpdate({
      ...block,
      settings: { ...block.settings, [key]: value },
    } as ContentBlock);
  };

  return (
    <div className="absolute -top-10 left-0 right-0 flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      {/* Left side: block info and alignment */}
      <div className="flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-1">
          {block.type.replace("_", " ")}
        </span>
        <div className="w-px h-4 bg-gray-200" />

        {/* Alignment buttons */}
        {block.type !== "divider" && (
          <>
            <button
              onClick={() => updateSettings("alignment", "left")}
              className={`p-1 rounded hover:bg-gray-100 ${block.settings.alignment === "left" ? "text-indigo-600 bg-indigo-50" : "text-gray-400"}`}
              title="Align left"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h10M4 18h14" />
              </svg>
            </button>
            <button
              onClick={() => updateSettings("alignment", "center")}
              className={`p-1 rounded hover:bg-gray-100 ${block.settings.alignment === "center" ? "text-indigo-600 bg-indigo-50" : "text-gray-400"}`}
              title="Align center"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M7 12h10M5 18h14" />
              </svg>
            </button>
            <button
              onClick={() => updateSettings("alignment", "right")}
              className={`p-1 rounded hover:bg-gray-100 ${block.settings.alignment === "right" ? "text-indigo-600 bg-indigo-50" : "text-gray-400"}`}
              title="Align right"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M10 12h10M6 18h14" />
              </svg>
            </button>
            <div className="w-px h-4 bg-gray-200" />
          </>
        )}

        {/* Width buttons */}
        <select
          value={block.settings.width || "normal"}
          onChange={(e) => updateSettings("width", e.target.value)}
          className="text-xs text-gray-500 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer py-0 px-1"
        >
          <option value="narrow">Narrow</option>
          <option value="normal">Normal</option>
          <option value="wide">Wide</option>
          <option value="full">Full</option>
        </select>
      </div>

      {/* Right side: actions */}
      <div className="flex items-center gap-0.5 bg-white rounded-lg shadow-lg border border-gray-200 px-1 py-1">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 15 7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalBlocks - 1}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={onDuplicate}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Duplicate"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
          title="Delete block"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
