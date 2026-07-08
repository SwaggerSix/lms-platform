"use client";

import { Edit3, FolderOpen, GripVertical, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { AdminCategory } from "./kb-shared";

interface CategoriesTabProps {
  categories: AdminCategory[];
  canManage: boolean;
  onEdit: (category: AdminCategory) => void;
  onDelete: (id: string) => void;
}

export default function CategoriesTab({ categories, canManage, onEdit, onDelete }: CategoriesTabProps) {
  return (
    <div className="mt-6">
      <div className="space-y-3">
        {categories
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm"
            >
              <GripVertical className="h-5 w-5 flex-shrink-0 cursor-grab text-gray-300" />
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100">
                <FolderOpen className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">{cat.name}</h3>
                <p className="text-xs text-gray-500 truncate">{cat.description}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {cat.articleCount} articles
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(cat)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Edit3 className="h-4 w-4" />
                  <span className="sr-only">Edit {cat.name}</span>
                </button>
                {canManage && (
                  <button
                    onClick={() => onDelete(cat.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete {cat.name}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
      {categories.length === 0 && (
        <EmptyState
          icon={<FolderOpen className="h-10 w-10" aria-hidden="true" />}
          title="No categories yet. Create your first one."
        />
      )}
    </div>
  );
}
