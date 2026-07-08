"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AdminCategory } from "./kb-shared";

interface CategoryModalProps {
  /** Non-null when editing; null when creating. */
  category: AdminCategory | null;
  /** Used to pick the sort_order for a new category. */
  categoryCount: number;
  onClose: () => void;
  /** Called with the created/updated category; the parent updates its list. */
  onSaved: (category: AdminCategory) => void;
}

export default function CategoryModal({ category, categoryCount, onClose, onSaved }: CategoryModalProps) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: category?.name ?? "",
    description: category?.description ?? "",
    icon: category?.icon ?? "FileText",
  });

  const handleSaveCategory = async () => {
    if (!form.name.trim()) return;

    try {
      if (category) {
        const res = await fetch("/api/knowledge-base", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "category",
            id: category.id,
            name: form.name,
            description: form.description,
            icon: form.icon,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update category");
        }
        onSaved({ ...category, name: form.name, description: form.description, icon: form.icon });
      } else {
        const res = await fetch("/api/knowledge-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "category",
            name: form.name,
            description: form.description,
            icon: form.icon,
            sort_order: categoryCount + 1,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create category");
        }
        const created = await res.json();
        onSaved({
          id: created.id,
          name: form.name,
          description: form.description,
          icon: form.icon,
          sortOrder: created.sort_order ?? categoryCount + 1,
          articleCount: 0,
        });
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred saving the category");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {category ? "Edit Category" : "Create New Category"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Category name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Brief description of this category"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <select
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Rocket">Rocket</option>
              <option value="BookOpen">BookOpen</option>
              <option value="Award">Award</option>
              <option value="Wrench">Wrench</option>
              <option value="FileText">FileText</option>
              <option value="User">User</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveCategory}>
            {category ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </div>
    </div>
  );
}
