"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  type ContentBlock,
  type BlockType,
  createBlock,
  reorderBlocks,
} from "@/lib/content/block-editor";
import { v4 as uuidv4 } from "uuid";
import BlockRenderer from "./block-renderer";
import BlockToolbar from "./block-toolbar";
import BlockTypePicker from "./block-type-picker";

interface ContentEditorProps {
  lessonId: string;
  initialBlocks: ContentBlock[];
  lessonTitle: string;
  courseTitle: string;
  courseSlug: string;
}

export default function ContentEditor({
  lessonId,
  initialBlocks,
  lessonTitle,
  courseTitle,
  courseSlug,
}: ContentEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);
  const [showPicker, setShowPicker] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // Auto-save with 2 second debounce
  const scheduleSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveToDB(blocksRef.current);
    }, 2000);
  }, []);

  // Save all blocks to the database
  const saveToDB = async (currentBlocks: ContentBlock[]) => {
    setSaveStatus("saving");
    try {
      // Fetch existing blocks
      const res = await fetch(`/api/content-blocks?lesson_id=${lessonId}`);
      const { blocks: existingBlocks } = await res.json();
      const existingIds = new Set((existingBlocks || []).map((b: { id: string }) => b.id));
      const currentIds = new Set(currentBlocks.map((b) => b.id));

      // Delete removed blocks
      for (const eb of existingBlocks || []) {
        if (!currentIds.has(eb.id)) {
          await fetch(`/api/content-blocks/${eb.id}`, { method: "DELETE" });
        }
      }

      // Create or update blocks
      for (let i = 0; i < currentBlocks.length; i++) {
        const block = currentBlocks[i];
        const payload = {
          block_type: block.type,
          content: { ...block.content, settings: block.settings },
          sequence_order: i,
        };

        if (existingIds.has(block.id)) {
          await fetch(`/api/content-blocks/${block.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          const createRes = await fetch("/api/content-blocks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, lesson_id: lessonId }),
          });
          if (createRes.ok) {
            const { block: created } = await createRes.json();
            // Update local block with server ID if needed
            currentBlocks[i] = { ...block, id: created.id };
          }
        }
      }

      setSaveStatus("saved");
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("error");
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Block operations
  const addBlock = (type: BlockType, atIndex: number) => {
    const newBlock = createBlock(type);
    const newBlocks = [...blocks];
    newBlocks.splice(atIndex, 0, newBlock);
    setBlocks(newBlocks);
    setSelectedBlockId(newBlock.id);
    scheduleSave();
  };

  const updateBlock = (index: number, updated: ContentBlock) => {
    const newBlocks = [...blocks];
    newBlocks[index] = updated;
    setBlocks(newBlocks);
    scheduleSave();
  };

  const deleteBlock = (index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    setBlocks(newBlocks);
    setSelectedBlockId(null);
    scheduleSave();
  };

  const duplicateBlock = (index: number) => {
    const original = blocks[index];
    const duplicate: ContentBlock = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
    };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, duplicate);
    setBlocks(newBlocks);
    scheduleSave();
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    const newBlocks = reorderBlocks(blocks, fromIndex, toIndex);
    setBlocks(newBlocks);
    scheduleSave();
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      moveBlock(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const openPicker = (index: number) => {
    setInsertIndex(index);
    setShowPicker(true);
  };

  const statusColors: Record<string, string> = {
    saved: "text-green-600",
    saving: "text-amber-600",
    unsaved: "text-gray-400",
    error: "text-red-600",
  };

  const statusLabels: Record<string, string> = {
    saved: "All changes saved",
    saving: "Saving...",
    unsaved: "Unsaved changes",
    error: "Save failed - will retry",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <a href={`/admin/courses`} className="text-gray-400 hover:text-gray-600 transition-colors">
                Courses
              </a>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
              <a href={`/admin/courses/${courseSlug}`} className="text-gray-400 hover:text-gray-600 transition-colors max-w-[150px] truncate">
                {courseTitle}
              </a>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
              <span className="text-gray-700 font-medium max-w-[200px] truncate">{lessonTitle}</span>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
              <span className="text-indigo-600 font-medium">Content Editor</span>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-xs font-medium ${statusColors[saveStatus]}`}>
                {saveStatus === "saving" && (
                  <svg className="w-3 h-3 animate-spin inline mr-1" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {statusLabels[saveStatus]}
              </span>
              <button
                onClick={() => saveToDB(blocks)}
                className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Save Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor canvas */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Empty state */}
        {blocks.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Start building your lesson</h3>
            <p className="text-sm text-gray-500 mb-6">Add content blocks to create rich, interactive lessons.</p>
            <button
              onClick={() => openPicker(0)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add First Block
            </button>
          </div>
        )}

        {/* Block list */}
        <div className="space-y-0">
          {blocks.map((block, index) => (
            <div key={block.id}>
              {/* Add block button between blocks */}
              <div className="flex items-center justify-center py-1 group/add">
                <button
                  onClick={() => openPicker(index)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-400 hover:text-indigo-600 opacity-0 group-hover/add:opacity-100 transition-all rounded-full hover:bg-indigo-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add block
                </button>
              </div>

              {/* Block wrapper */}
              <div
                className={`group relative rounded-xl border transition-all ${
                  selectedBlockId === block.id
                    ? "border-indigo-300 bg-white shadow-sm ring-1 ring-indigo-100"
                    : "border-transparent hover:border-gray-200 bg-white hover:shadow-sm"
                } ${dragOverIndex === index ? "border-indigo-400 border-dashed" : ""} ${
                  dragIndex === index ? "opacity-50" : ""
                }`}
                onClick={() => setSelectedBlockId(block.id)}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => setDragOverIndex(null)}
              >
                {/* Drag handle */}
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                  <svg className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                  </svg>
                </div>

                {/* Block toolbar */}
                <BlockToolbar
                  block={block}
                  index={index}
                  totalBlocks={blocks.length}
                  onUpdate={(updated) => updateBlock(index, updated)}
                  onDelete={() => deleteBlock(index)}
                  onDuplicate={() => duplicateBlock(index)}
                  onMoveUp={() => moveBlock(index, index - 1)}
                  onMoveDown={() => moveBlock(index, index + 1)}
                />

                {/* Block content */}
                <div className="px-5 py-4">
                  <BlockRenderer
                    block={block}
                    editable
                    onUpdate={(updated) => updateBlock(index, updated)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add block button at the end */}
        {blocks.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <button
              onClick={() => openPicker(blocks.length)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-indigo-600 border-2 border-dashed border-gray-200 hover:border-indigo-300 rounded-xl transition-all hover:bg-indigo-50/50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add block
            </button>
          </div>
        )}
      </div>

      {/* Block type picker modal */}
      {showPicker && (
        <BlockTypePicker
          onSelect={(type) => {
            if (insertIndex !== null) {
              addBlock(type, insertIndex);
            }
            setShowPicker(false);
            setInsertIndex(null);
          }}
          onClose={() => {
            setShowPicker(false);
            setInsertIndex(null);
          }}
        />
      )}
    </div>
  );
}
