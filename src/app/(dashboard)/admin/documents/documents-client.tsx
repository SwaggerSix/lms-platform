"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileStack,
  FolderPlus,
  Upload,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import type {
  DocumentWithUploader,
  FolderWithMeta,
  AcknowledgmentWithUser,
  VersionHistoryEntry,
} from "./documents-types";
import FolderSidebar from "./folder-sidebar";
import DocumentTable from "./document-table";
import DocumentFormModal from "./document-form-modal";
import FolderFormModal from "./folder-form-modal";
import AcknowledgmentsModal from "./acknowledgments-modal";
import VersionHistoryModal from "./version-history-modal";

export interface DocumentsClientProps {
  initialFolders: FolderWithMeta[];
  initialDocuments: DocumentWithUploader[];
  acknowledgments: AcknowledgmentWithUser[];
  versionHistory: VersionHistoryEntry[];
  /** Full management rights (delete, acknowledgments). Admins only; instructors can add/edit but not delete. */
  canManage?: boolean;
}

type ModalType =
  | "upload"
  | "editDoc"
  | "createFolder"
  | "editFolder"
  | "acknowledgments"
  | "versionHistory"
  | null;

export default function DocumentsClient({
  initialFolders,
  initialDocuments,
  acknowledgments,
  versionHistory,
  canManage = true,
}: DocumentsClientProps) {
  const toast = useToast();
  const [folders, setFolders] = useState<FolderWithMeta[]>(initialFolders);
  const [documents, setDocuments] = useState<DocumentWithUploader[]>(initialDocuments);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentWithUploader | null>(null);
  const [editingFolder, setEditingFolder] = useState<FolderWithMeta | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [viewAckDocId, setViewAckDocId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // Stats
  const totalDocuments = documents.length;
  const policiesRequiringAck = documents.filter(
    (d) => d.is_policy && d.acknowledgment_required
  ).length;
  const pendingAcks = documents.filter(
    (d) => d.acknowledgment_required
  ).length;

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
  }, [documents, selectedFolderId, searchQuery]);

  // Handlers -----------------------------------------------------------------

  const selectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setCurrentPage(1);
  };

  const handleDocSaved = (saved: DocumentWithUploader) => {
    setDocuments((prev) =>
      prev.some((d) => d.id === saved.id)
        ? prev.map((d) => (d.id === saved.id ? saved : d))
        : [...prev, saved]
    );
  };

  const handleFolderSaved = (saved: FolderWithMeta) => {
    setFolders((prev) =>
      prev.some((f) => f.id === saved.id)
        ? prev.map((f) => (f.id === saved.id ? saved : f))
        : [...prev, saved]
    );
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(docId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete document");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred deleting the document");
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setDocuments((prev) =>
      prev.map((d) => (d.folder_id === folderId ? { ...d, folder_id: null } : d))
    );
    if (selectedFolderId === folderId) setSelectedFolderId(null);
  };

  const toggleSelectDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === filteredDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredDocuments.map((d) => d.id)));
    }
  };

  const handleBulkDelete = () => {
    setDocuments((prev) => prev.filter((d) => !selectedDocIds.has(d.id)));
    setSelectedDocIds(new Set());
  };

  const handleBulkMove = (folderId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        selectedDocIds.has(d.id) ? { ...d, folder_id: folderId } : d
      )
    );
    setSelectedDocIds(new Set());
  };

  const acksForDoc = viewAckDocId
    ? acknowledgments.filter((a) => a.document_id === viewAckDocId)
    : [];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Document Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage policies, procedures, and organizational documents
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setEditingFolder(null);
                setActiveModal("createFolder");
              }}
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
            <Button
              onClick={() => {
                setEditingDoc(null);
                setActiveModal("upload");
              }}
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileStack className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {totalDocuments}
                </p>
                <p className="text-xs text-gray-500">Total Documents</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {policiesRequiringAck}
                </p>
                <p className="text-xs text-gray-500">
                  Policies Requiring Acknowledgment
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {pendingAcks}
                </p>
                <p className="text-xs text-gray-500">
                  Pending Acknowledgments
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <FolderSidebar
          folders={folders}
          documents={documents}
          selectedFolderId={selectedFolderId}
          canManage={canManage}
          onSelectFolder={selectFolder}
          onEditFolder={(folder) => {
            setEditingFolder(folder);
            setActiveModal("editFolder");
          }}
          onDeleteFolder={handleDeleteFolder}
        />

        {/* Main content */}
        <main className="flex-1 p-6">
          {/* Search & Bulk actions */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {selectedDocIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {selectedDocIds.size} selected
                </span>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleBulkMove(e.target.value);
                  }}
                  defaultValue=""
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>
                    Move to...
                  </option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {canManage && (
                  <Button variant="outline-destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Breadcrumb */}
          {selectedFolder && (
            <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
              <button
                onClick={() => selectFolder(null)}
                className="hover:text-indigo-600"
              >
                All Documents
              </button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-gray-900 font-medium">
                {selectedFolder.name}
              </span>
            </nav>
          )}

          <DocumentTable
            documents={filteredDocuments}
            acknowledgments={acknowledgments}
            selectedDocIds={selectedDocIds}
            currentPage={currentPage}
            canManage={canManage}
            onPageChange={setCurrentPage}
            onToggleSelect={toggleSelectDoc}
            onToggleSelectAll={toggleSelectAll}
            onEditDocument={(doc) => {
              setEditingDoc(doc);
              setActiveModal("editDoc");
            }}
            onDeleteDocument={handleDeleteDoc}
            onViewAcknowledgments={(docId) => {
              setViewAckDocId(docId);
              setActiveModal("acknowledgments");
            }}
            onViewHistory={() => setActiveModal("versionHistory")}
          />
        </main>
      </div>

      {/* Modals */}
      {(activeModal === "upload" || activeModal === "editDoc") && (
        <DocumentFormModal
          doc={activeModal === "editDoc" ? editingDoc : null}
          folders={folders}
          defaultFolderId={selectedFolderId ?? ""}
          onClose={() => setActiveModal(null)}
          onSaved={handleDocSaved}
        />
      )}

      {(activeModal === "createFolder" || activeModal === "editFolder") && (
        <FolderFormModal
          folder={activeModal === "editFolder" ? editingFolder : null}
          folderCount={folders.length}
          onClose={() => setActiveModal(null)}
          onSaved={handleFolderSaved}
        />
      )}

      {activeModal === "acknowledgments" && viewAckDocId && (
        <AcknowledgmentsModal
          acknowledgments={acksForDoc}
          onClose={() => {
            setActiveModal(null);
            setViewAckDocId(null);
          }}
        />
      )}

      {activeModal === "versionHistory" && (
        <VersionHistoryModal
          versionHistory={versionHistory}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
