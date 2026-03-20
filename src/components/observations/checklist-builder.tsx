"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  CheckSquare,
  Star,
  Type,
  ToggleLeft,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";

// ─── Types ───────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  type: "checkbox" | "rating" | "text" | "yes_no";
  required: boolean;
  weight: number;
}

interface ChecklistBuilderProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

// ─── Type metadata ──────────────────────────────────────────────

const ITEM_TYPES = [
  { value: "checkbox" as const, label: "Checkbox", icon: CheckSquare, description: "Pass/fail check" },
  { value: "rating" as const, label: "Rating (1-5)", icon: Star, description: "Numeric rating scale" },
  { value: "text" as const, label: "Text", icon: Type, description: "Free-text observation" },
  { value: "yes_no" as const, label: "Yes / No", icon: ToggleLeft, description: "Binary response" },
];

// ─── Component ──────────────────────────────────────────────────

export default function ChecklistBuilder({ items, onChange }: ChecklistBuilderProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const addItem = useCallback((type: ChecklistItem["type"] = "checkbox") => {
    const newItem: ChecklistItem = {
      id: generateId(),
      label: "",
      type,
      required: false,
      weight: 1,
    };
    onChange([...items, newItem]);
  }, [items, onChange]);

  const updateItem = useCallback((index: number, updates: Partial<ChecklistItem>) => {
    const updated = items.map((item, i) => (i === index ? { ...item, ...updates } : item));
    onChange(updated);
  }, [items, onChange]);

  const removeItem = useCallback((index: number) => {
    onChange(items.filter((_, i) => i !== index));
  }, [items, onChange]);

  const duplicateItem = useCallback((index: number) => {
    const item = items[index];
    const newItem = { ...item, id: generateId(), label: `${item.label} (copy)` };
    const updated = [...items];
    updated.splice(index + 1, 0, newItem);
    onChange(updated);
  }, [items, onChange]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const updated = [...items];
    const [removed] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, removed);
    onChange(updated);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const typeIcon = (type: ChecklistItem["type"]) => {
    const meta = ITEM_TYPES.find((t) => t.value === type);
    if (!meta) return null;
    const Icon = meta.icon;
    return <Icon className="h-3.5 w-3.5" />;
  };

  return (
    <div className="space-y-4">
      {/* Items list */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "group rounded-lg border bg-white p-3 transition-all",
              dragIndex === index
                ? "ring-2 ring-blue-300 shadow-md border-blue-200"
                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
            )}
          >
            <div className="flex items-start gap-2">
              {/* Drag handle */}
              <button
                className="mt-1 cursor-grab text-gray-300 hover:text-gray-500 transition-colors"
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>

              {/* Item number */}
              <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500">
                {index + 1}
              </span>

              {/* Main content */}
              <div className="flex-1 space-y-2">
                {/* Label input */}
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(index, { label: e.target.value })}
                  placeholder="Enter checklist item label..."
                  className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                />

                {/* Item options row */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Type selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Type:</span>
                    <select
                      value={item.type}
                      onChange={(e) => updateItem(index, { type: e.target.value as ChecklistItem["type"] })}
                      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 outline-none"
                    >
                      {ITEM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Weight */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Weight:</span>
                    <input
                      type="number"
                      value={item.weight}
                      onChange={(e) => updateItem(index, { weight: parseFloat(e.target.value) || 0 })}
                      min={0}
                      max={100}
                      step={0.5}
                      className="w-16 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-blue-400 outline-none"
                    />
                  </div>

                  {/* Required toggle */}
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) => updateItem(index, { required: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600">Required</span>
                  </label>

                  {/* Type indicator badge */}
                  <span className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    item.type === "checkbox" && "bg-green-50 text-green-700",
                    item.type === "rating" && "bg-yellow-50 text-yellow-700",
                    item.type === "text" && "bg-blue-50 text-blue-700",
                    item.type === "yes_no" && "bg-purple-50 text-purple-700",
                  )}>
                    {typeIcon(item.type)}
                    {ITEM_TYPES.find((t) => t.value === item.type)?.label}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => duplicateItem(index)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  title="Duplicate"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeItem(index)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Validation warning */}
            {item.label.trim() === "" && (
              <div className="mt-2 ml-11 flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Label is required
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center">
          <CheckSquare className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No checklist items yet</p>
          <p className="text-xs text-gray-400">Add items to build your observation checklist</p>
        </div>
      )}

      {/* Add item buttons */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <span className="text-xs font-medium text-gray-500 mr-1">Add item:</span>
        {ITEM_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              onClick={() => addItem(type.value)}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Icon className="h-3.5 w-3.5" />
              {type.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
