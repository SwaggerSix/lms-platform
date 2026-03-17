"use client";

import { useState, useMemo } from "react";
import { cn } from "@/utils/cn";
import type { Document, DocumentFolder } from "@/types/database";
import {
  Search,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  Download,
  FolderOpen,
  Folder,
  ChevronRight,
  LayoutGrid,
  List,
  Tag,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  Home,
  Clock,
  HardDrive,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Exported types for server component usage
// ---------------------------------------------------------------------------

export type DocumentWithAcknowledgment = Document & { acknowledged?: boolean };
export type FolderWithMeta = DocumentFolder & { icon_name?: string };

export interface DocumentsClientProps {
  folders: FolderWithMeta[];
  documents: DocumentWithAcknowledgment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FileTypeIcon({
  fileType,
  className,
}: {
  fileType: string;
  className?: string;
}) {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return <FileText className={cn("text-red-500", className)} />;
    case "docx":
    case "doc":
      return <FileText className={cn("text-blue-500", className)} />;
    case "xlsx":
    case "xls":
      return <FileSpreadsheet className={cn("text-green-500", className)} />;
    case "pptx":
    case "ppt":
      return <Presentation className={cn("text-orange-500", className)} />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return <Image className={cn("text-purple-500", className)} />;
    default:
      return <FileText className={cn("text-gray-400", className)} />;
  }
}

function fileTypeBadgeColor(fileType: string): string {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return "bg-red-100 text-red-700";
    case "docx":
    case "doc":
      return "bg-blue-100 text-blue-700";
    case "xlsx":
    case "xls":
      return "bg-green-100 text-green-700";
    case "pptx":
    case "ppt":
      return "bg-orange-100 text-orange-700";
    case "png":
    case "jpg":
    case "jpeg":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// ---------------------------------------------------------------------------
// Client Component
// ---------------------------------------------------------------------------

export default function DocumentsClient({
  folders,
  documents,
}: DocumentsClientProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(
    new Set(
      documents
        .filter((d) => d.acknowledged)
        .map((d) => d.id)
    )
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const filteredDocuments = useMemo(() => {
    let docs = documents;

    if (selectedFolderId) {
      docs = docs.filter((d) => d.folder_id === selectedFolderId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.description ?? "").toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return docs;
  }, [selectedFolderId, searchQuery, documents]);

  const handleAcknowledge = (docId: string) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      next.add(docId);
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* ---- Sidebar ---- */}
      <aside
        className={cn(
          "border-r border-gray-200 bg-white transition-all duration-200 flex flex-col",
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}
      >
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Folders
          </h2>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {/* All Documents */}
          <button
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              "w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors",
              selectedFolderId === null
                ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600"
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
            <button
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors",
                selectedFolderId === folder.id
                  ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate">{folder.name}</span>
              <span className="ml-auto text-xs text-gray-400">
                {folder.document_count}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ---- Main Content ---- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className="hover:text-indigo-600 flex items-center gap-1"
                >
                  <Home className="h-3.5 w-3.5" />
                  Documents
                </button>
                {selectedFolder && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-gray-900 font-medium">
                      {selectedFolder.name}
                    </span>
                  </>
                )}
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedFolder ? selectedFolder.name : "Document Repository"}
              </h1>
              {selectedFolder && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedFolder.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle sidebar */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    sidebarOpen ? "rotate-90" : "-rotate-90"
                  )}
                />
              </button>

              {/* View toggle */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-2 transition-colors",
                    viewMode === "list"
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-400 hover:bg-gray-50"
                  )}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-2 transition-colors",
                    viewMode === "grid"
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-400 hover:bg-gray-50"
                  )}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </header>

        {/* Document list / grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FileText className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium">No documents found</p>
              <p className="text-sm mt-1">
                {searchQuery
                  ? "Try adjusting your search query."
                  : "This folder is empty."}
              </p>
            </div>
          ) : viewMode === "list" ? (
            /* -------- List View -------- */
            <div className="space-y-3">
              {filteredDocuments.map((doc) => {
                const isAcknowledged = acknowledgedIds.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      {/* File icon */}
                      <div className="mt-1 shrink-0">
                        <FileTypeIcon
                          fileType={doc.file_type}
                          className="h-8 w-8"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {doc.title}
                          </h3>
                          {doc.is_policy && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                              <ShieldCheck className="h-3 w-3" />
                              Policy
                            </span>
                          )}
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium uppercase",
                              fileTypeBadgeColor(doc.file_type)
                            )}
                          >
                            {doc.file_type}
                          </span>
                        </div>

                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                          {doc.description}
                        </p>

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatFileSize(doc.file_size)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(doc.updated_at)}
                          </span>
                          <span>v{doc.version}</span>
                        </div>

                        {/* Tags */}
                        {doc.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Tag className="h-3 w-3 text-gray-400" />
                            {doc.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {doc.acknowledgment_required && !isAcknowledged && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Acknowledgment Required
                            </span>
                            <button
                              onClick={() => handleAcknowledge(doc.id)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              I Acknowledge
                            </button>
                          </div>
                        )}
                        {doc.acknowledgment_required && isAcknowledged && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Acknowledged
                          </span>
                        )}
                        <button
                          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* -------- Grid View -------- */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDocuments.map((doc) => {
                const isAcknowledged = acknowledgedIds.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <FileTypeIcon
                        fileType={doc.file_type}
                        className="h-10 w-10"
                      />
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium uppercase",
                          fileTypeBadgeColor(doc.file_type)
                        )}
                      >
                        {doc.file_type}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                      {doc.title}
                    </h3>

                    {doc.is_policy && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 mt-2 w-fit">
                        <ShieldCheck className="h-3 w-3" />
                        Policy
                      </span>
                    )}

                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 flex-1">
                      {doc.description}
                    </p>

                    {/* Tags */}
                    {doc.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {doc.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        {doc.tags.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{doc.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>{formatDate(doc.updated_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      {doc.acknowledgment_required && !isAcknowledged ? (
                        <button
                          onClick={() => handleAcknowledge(doc.id)}
                          className="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors text-center"
                        >
                          I Acknowledge
                        </button>
                      ) : doc.acknowledgment_required && isAcknowledged ? (
                        <span className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-green-600 font-medium">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Acknowledged
                        </span>
                      ) : (
                        <div className="flex-1" />
                      )}
                      <button
                        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
