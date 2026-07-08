"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { DocumentVisibility } from "@/types/database";
import type { FolderWithMeta } from "./documents-types";

interface FolderFormModalProps {
  /** Non-null when editing; null when creating. */
  folder: FolderWithMeta | null;
  /** Used to pick the sort_order for a new folder. */
  folderCount: number;
  onClose: () => void;
  /** Called with the created/updated folder; the parent updates its list. */
  onSaved: (folder: FolderWithMeta) => void;
}

export default function FolderFormModal({
  folder,
  folderCount,
  onClose,
  onSaved,
}: FolderFormModalProps) {
  const isEdit = folder !== null;
  const [name, setName] = useState(folder?.name ?? "");
  const [description, setDescription] = useState(folder?.description ?? "");
  const [visibility, setVisibility] = useState<DocumentVisibility>(folder?.visibility ?? "all");

  const handleSave = () => {
    if (isEdit) {
      onSaved({
        ...folder,
        name,
        description,
        visibility,
        updated_at: new Date().toISOString(),
      });
    } else {
      onSaved({
        id: `f${Date.now()}`,
        name,
        description,
        parent_id: null,
        organization_id: null,
        visibility,
        sort_order: folderCount + 1,
        created_by: "admin-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        document_count: 0,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Folder" : "Create Folder"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Folder name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Brief description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as DocumentVisibility)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Everyone</option>
              <option value="managers">Managers Only</option>
              <option value="admins">Admins Only</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
