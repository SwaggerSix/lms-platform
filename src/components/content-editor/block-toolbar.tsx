"use client";

import { type ContentBlock, type BlockType } from "@/lib/content/block-editor";
import { AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown, Copy, Trash2 } from "lucide-react";

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
              className={`p-1 rounded hover:bg-gray-100 ${block.settings.alignment === "left" ? "text-primary-600 bg-primary-50" : "text-gray-400"}`}
              title="Align left"
            >
              <AlignLeft className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button
              onClick={() => updateSettings("alignment", "center")}
              className={`p-1 rounded hover:bg-gray-100 ${block.settings.alignment === "center" ? "text-primary-600 bg-primary-50" : "text-gray-400"}`}
              title="Align center"
            >
              <AlignCenter className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button
              onClick={() => updateSettings("alignment", "right")}
              className={`p-1 rounded hover:bg-gray-100 ${block.settings.alignment === "right" ? "text-primary-600 bg-primary-50" : "text-gray-400"}`}
              title="Align right"
            >
              <AlignRight className="w-3.5 h-3.5" strokeWidth={2} />
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
          <ChevronUp className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalBlocks - 1}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={onDuplicate}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Duplicate"
        >
          <Copy className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
