"use client";

import { cn } from "@/utils/cn";
import { Folder, FolderOpen, GripVertical, Pencil, Trash2, Users } from "lucide-react";
import type { DocumentWithUploader, FolderWithMeta } from "./documents-types";

interface FolderSidebarProps {
  folders: FolderWithMeta[];
  documents: DocumentWithUploader[];
  selectedFolderId: string | null;
  canManage: boolean;
  onSelectFolder: (folderId: string | null) => void;
  onEditFolder: (folder: FolderWithMeta) => void;
  onDeleteFolder: (folderId: string) => void;
}

export default function FolderSidebar({
  folders,
  documents,
  selectedFolderId,
  canManage,
  onSelectFolder,
  onEditFolder,
  onDeleteFolder,
}: FolderSidebarProps) {
  return (
    <aside className="w-full border-b border-gray-200 bg-white md:min-h-[calc(100vh-200px)] md:w-72 md:border-b-0 md:border-r">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Folders
        </h2>
      </div>
      <nav className="py-2">
        <button
          onClick={() => onSelectFolder(null)}
          className={cn(
            "w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors",
            selectedFolderId === null
              ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600"
              : "text-gray-700 hover:bg-gray-50"
          )}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span>All Documents</span>
          <span className="ml-auto text-xs text-gray-400">
            {documents.length}
          </span>
        </button>

        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            <button
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors",
                selectedFolderId === folder.id
                  ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <GripVertical className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 shrink-0" />
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate">{folder.name}</span>
              {folder.visibility === "managers" && (
                <Users className="h-3 w-3 text-gray-400 shrink-0" />
              )}
              <span className="ml-auto text-xs text-gray-400">
                {documents.filter((d) => d.folder_id === folder.id).length}
              </span>
            </button>
            {/* Folder actions on hover */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditFolder(folder);
                }}
                className="p-1 rounded hover:bg-gray-200 text-gray-400"
                title="Edit folder"
              >
                <Pencil className="h-3 w-3" />
              </button>
              {canManage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder.id);
                  }}
                  className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                  title="Delete folder"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
