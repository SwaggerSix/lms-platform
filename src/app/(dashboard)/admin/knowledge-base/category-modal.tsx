"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
    <Modal
      isOpen
      onClose={onClose}
      title={category ? "Edit Category" : "Create New Category"}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveCategory}>
            {category ? "Save Changes" : "Create Category"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Category name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Brief description of this category"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <select
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
    </Modal>
  );
}
