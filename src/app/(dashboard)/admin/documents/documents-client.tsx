"use client";

import { useState, useMemo } from "react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";
import type {
  Document,
  DocumentFolder,
  DocumentAcknowledgment,
  DocumentVisibility,
} from "@/types/database";
import {
  Search,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  Plus,
  Pencil,
  Trash2,
  FolderPlus,
  Folder,
  FolderOpen,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Clock,
  HardDrive,
  Tag,
  MoreVertical,
  GripVertical,
  Check,
  Users,
  FileStack,
  CheckCircle2,
  History,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Exported interfaces for server component
// ---------------------------------------------------------------------------

export interface DocumentWithUploader extends Document {
  uploader_name?: string;
}

export interface FolderWithMeta extends DocumentFolder {
  icon_name?: string;
}

export interface AcknowledgmentWithUser extends DocumentAcknowledgment {
  user_name: string;
  user_email: string;
}

export interface VersionHistoryEntry {
  version: number;
  uploaded_by: string;
  uploaded_at: string;
  change_notes: string;
}

export interface DocumentsClientProps {
  initialFolders: FolderWithMeta[];
  initialDocuments: DocumentWithUploader[];
  acknowledgments: AcknowledgmentWithUser[];
  versionHistory: VersionHistoryEntry[];
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

type ModalType =
  | "upload"
  | "editDoc"
  | "createFolder"
  | "editFolder"
  | "acknowledgments"
  | "versionHistory"
  | null;

export default function DocumentsClient({
  initialFolders: initialFoldersProp,
  initialDocuments: initialDocumentsProp,
  acknowledgments: mockAcknowledgments,
  versionHistory: mockVersionHistory,
}: DocumentsClientProps) {
  const toast = useToast();
  const [folders, setFolders] =
    useState<FolderWithMeta[]>(initialFoldersProp);
  const [documents, setDocuments] = useState<DocumentWithUploader[]>(initialDocumentsProp);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentWithUploader | null>(null);
  const [editingFolder, setEditingFolder] = useState<
    FolderWithMeta | null
  >(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [viewAckDocId, setViewAckDocId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Form state for upload / edit doc
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFolderId, setFormFolderId] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formVisibility, setFormVisibility] = useState<DocumentVisibility>("all");
  const [formIsPolicy, setFormIsPolicy] = useState(false);
  const [formAckRequired, setFormAckRequired] = useState(false);

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form state for folder
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderVisibility, setFolderVisibility] = useState<DocumentVisibility>("all");

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

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showStart = (currentPage - 1) * pageSize;
  const showEnd = Math.min(currentPage * pageSize, filteredDocuments.length);

  const getPageNumbers = () => {
    const pages: number[] = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // Handlers -----------------------------------------------------------------

  const resetDocForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormFolderId(selectedFolderId ?? "");
    setFormTags("");
    setFormVisibility("all");
    setFormIsPolicy(false);
    setFormAckRequired(false);
    setUploadFile(null);
    setUploadProgress("idle");
    setUploadError(null);
  };

  const resetFolderForm = () => {
    setFolderName("");
    setFolderDescription("");
    setFolderVisibility("all");
  };

  const openUploadModal = () => {
    resetDocForm();
    setFormFolderId(selectedFolderId ?? "");
    setEditingDoc(null);
    setActiveModal("upload");
  };

  const openEditDocModal = (doc: DocumentWithUploader) => {
    setEditingDoc(doc);
    setFormTitle(doc.title);
    setFormDescription(doc.description ?? "");
    setFormFolderId(doc.folder_id ?? "");
    setFormTags(doc.tags.join(", "));
    setFormVisibility(doc.visibility);
    setFormIsPolicy(doc.is_policy);
    setFormAckRequired(doc.acknowledgment_required);
    setActiveModal("editDoc");
  };

  const openCreateFolderModal = () => {
    resetFolderForm();
    setEditingFolder(null);
    setActiveModal("createFolder");
  };

  const openEditFolderModal = (
    folder: FolderWithMeta
  ) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderDescription(folder.description ?? "");
    setFolderVisibility(folder.visibility);
    setActiveModal("editFolder");
  };

  const handleSaveDoc = async () => {
    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (activeModal === "editDoc" && editingDoc) {
        const res = await fetch("/api/documents", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingDoc.id,
            title: formTitle,
            description: formDescription,
            folder_id: formFolderId || null,
            tags,
            visibility: formVisibility,
            is_policy: formIsPolicy,
            acknowledgment_required: formAckRequired,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update document");
        }
        const { data: updated } = await res.json();
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === editingDoc.id
              ? {
                  ...d,
                  title: formTitle,
                  description: formDescription,
                  folder_id: formFolderId || null,
                  tags,
                  visibility: formVisibility,
                  is_policy: formIsPolicy,
                  acknowledgment_required: formAckRequired,
                  updated_at: updated?.updated_at ?? new Date().toISOString(),
                }
              : d
          )
        );
      } else {
        // Upload file first if one is selected
        let fileUrl = "#";
        let fileName = `${formTitle.toLowerCase().replace(/\s+/g, "-")}.pdf`;
        let fileType = "pdf";
        let fileSize = 0;
        let mimeType: string | null = null;

        if (uploadFile) {
          setUploadProgress("uploading");
          setUploadError(null);

          const uploadFormData = new FormData();
          uploadFormData.append("file", uploadFile);
          uploadFormData.append("bucket", "documents");
          if (formFolderId) {
            uploadFormData.append("folderId", formFolderId);
          }

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadFormData,
          });

          if (!uploadRes.ok) {
            const uploadErr = await uploadRes.json();
            setUploadProgress("error");
            setUploadError(uploadErr.error || "Upload failed");
            throw new Error(uploadErr.error || "File upload failed");
          }

          const uploadData = await uploadRes.json();
          setUploadProgress("done");

          fileUrl = uploadData.url;
          fileName = uploadFile.name;
          fileType = uploadFile.name.split(".").pop() || "unknown";
          fileSize = uploadFile.size;
          mimeType = uploadFile.type;
        }

        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folder_id: formFolderId || null,
            title: formTitle,
            description: formDescription,
            file_url: fileUrl,
            file_name: fileName,
            file_type: fileType,
            file_size: fileSize,
            mime_type: mimeType,
            tags,
            visibility: formVisibility,
            is_policy: formIsPolicy,
            acknowledgment_required: formAckRequired,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create document");
        }
        const { data: created } = await res.json();
        const newDoc: DocumentWithUploader = {
          id: created.id,
          folder_id: created.folder_id,
          title: created.title,
          description: created.description,
          file_url: created.file_url,
          file_name: created.file_name,
          file_type: created.file_type,
          file_size: created.file_size,
          mime_type: created.mime_type,
          version: created.version,
          tags: created.tags ?? [],
          organization_id: created.organization_id,
          visibility: created.visibility,
          is_policy: created.is_policy,
          effective_date: created.effective_date,
          expiry_date: created.expiry_date,
          acknowledgment_required: created.acknowledgment_required,
          uploaded_by: created.uploaded_by,
          created_at: created.created_at,
          updated_at: created.updated_at,
        };
        setDocuments((prev) => [...prev, newDoc]);
      }
      setActiveModal(null);
    } catch (err) {
      if (uploadProgress !== "error") {
        toast.error(err instanceof Error ? err.message : "An error occurred saving the document");
      }
    }
  };

  const handleSaveFolder = () => {
    if (activeModal === "editFolder" && editingFolder) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === editingFolder.id
            ? {
                ...f,
                name: folderName,
                description: folderDescription,
                visibility: folderVisibility,
                updated_at: new Date().toISOString(),
              }
            : f
        )
      );
    } else {
      const newFolder: FolderWithMeta = {
        id: `f${Date.now()}`,
        name: folderName,
        description: folderDescription,
        parent_id: null,
        organization_id: null,
        visibility: folderVisibility,
        sort_order: folders.length + 1,
        created_by: "admin-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        document_count: 0,
      };
      setFolders((prev) => [...prev, newFolder]);
    }
    setActiveModal(null);
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
      setOpenMenuId(null);
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
    ? mockAcknowledgments.filter((a) => a.document_id === viewAckDocId)
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
            <button
              onClick={openCreateFolderModal}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
            <button
              onClick={openUploadModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </button>
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
        {/* Sidebar -- Folder list */}
        <aside className="w-72 border-r border-gray-200 bg-white min-h-[calc(100vh-200px)]">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Folders
            </h2>
          </div>
          <nav className="py-2">
            <button
              onClick={() => { setSelectedFolderId(null); setCurrentPage(1); }}
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
              <div key={folder.id} className="group relative">
                <button
                  onClick={() => { setSelectedFolderId(folder.id); setCurrentPage(1); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors",
                    selectedFolderId === folder.id
                      ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600"
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
                      openEditFolderModal(folder);
                    }}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400"
                    title="Edit folder"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder.id);
                    }}
                    className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                    title="Delete folder"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </nav>
        </aside>

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
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Breadcrumb */}
          {selectedFolder && (
            <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
              <button
                onClick={() => { setSelectedFolderId(null); setCurrentPage(1); }}
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

          {/* Document Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        filteredDocuments.length > 0 &&
                        selectedDocIds.size === filteredDocuments.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedDocuments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      <FileText className="h-10 w-10 mx-auto mb-2" />
                      <p className="font-medium">No documents found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedDocuments.map((doc) => {
                    const ackCount = mockAcknowledgments.filter(
                      (a) => a.document_id === doc.id
                    ).length;
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedDocIds.has(doc.id)}
                            onChange={() => toggleSelectDoc(doc.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <FileTypeIcon
                              fileType={doc.file_type}
                              className="h-6 w-6 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {doc.title}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {doc.file_name}
                              </p>
                              {doc.tags.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  {doc.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium uppercase",
                              fileTypeBadgeColor(doc.file_type)
                            )}
                          >
                            {doc.file_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              doc.visibility === "all"
                                ? "bg-green-100 text-green-700"
                                : doc.visibility === "managers"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            )}
                          >
                            {doc.visibility === "all"
                              ? "Everyone"
                              : doc.visibility === "managers"
                              ? "Managers"
                              : "Admins"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {doc.is_policy && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                                <ShieldCheck className="h-3 w-3" />
                                Policy
                              </span>
                            )}
                            {doc.acknowledgment_required && (
                              <button
                                onClick={() => {
                                  setViewAckDocId(doc.id);
                                  setActiveModal("acknowledgments");
                                }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {ackCount} acknowledged
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <div>
                            <p>{formatDate(doc.updated_at)}</p>
                            <p className="text-xs text-gray-400">
                              v{doc.version}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 relative">
                          <button
                            onClick={() =>
                              setOpenMenuId(
                                openMenuId === doc.id ? null : doc.id
                              )
                            }
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openMenuId === doc.id && (
                            <div className="absolute right-4 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48 z-10">
                              <button
                                onClick={() => {
                                  openEditDocModal(doc);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setActiveModal("versionHistory");
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <History className="h-3.5 w-3.5" />
                                Version History
                              </button>
                              {doc.acknowledgment_required && (
                                <button
                                  onClick={() => {
                                    setViewAckDocId(doc.id);
                                    setActiveModal("acknowledgments");
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Acknowledgments
                                </button>
                              )}
                              <hr className="my-1 border-gray-100" />
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredDocuments.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                Showing {showStart + 1}-{showEnd} of {filteredDocuments.length} documents
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                {getPageNumbers().map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium",
                      currentPage === p ? "bg-indigo-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ================================================================== */}
      {/* Modals                                                             */}
      {/* ================================================================== */}

      {/* Upload / Edit Document Modal */}
      {(activeModal === "upload" || activeModal === "editDoc") && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {activeModal === "editDoc"
                  ? "Edit Document"
                  : "Upload Document"}
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* File upload area (only for new uploads) */}
              {activeModal === "upload" && (
                <div>
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) {
                        setUploadFile(droppedFile);
                        setUploadProgress("idle");
                        setUploadError(null);
                        if (!formTitle.trim()) {
                          setFormTitle(droppedFile.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
                        }
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                      uploadFile
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                    )}
                  >
                    {uploadFile ? (
                      <>
                        <CheckCircle2 className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-900 truncate max-w-full">
                          {uploadFile.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setUploadFile(null);
                            setUploadProgress("idle");
                            setUploadError(null);
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
                        >
                          Remove file
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                          Drag & drop a file here, or click to browse
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PDF, DOCX, XLSX, PPTX, images up to 50MB
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv"
                      className="sr-only"
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        if (selected) {
                          setUploadFile(selected);
                          setUploadProgress("idle");
                          setUploadError(null);
                          if (!formTitle.trim()) {
                            setFormTitle(selected.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
                          }
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {uploadProgress === "uploading" && (
                    <p className="mt-2 text-sm text-indigo-600 flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Uploading file...
                    </p>
                  )}
                  {uploadError && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      {uploadError}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Document title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Brief description of the document"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Folder
                </label>
                <select
                  value={formFolderId}
                  onChange={(e) => setFormFolderId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="policy, compliance, training"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={formVisibility}
                  onChange={(e) =>
                    setFormVisibility(e.target.value as DocumentVisibility)
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Everyone</option>
                  <option value="managers">Managers Only</option>
                  <option value="admins">Admins Only</option>
                </select>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formIsPolicy}
                    onChange={(e) => setFormIsPolicy(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">Is Policy Document</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formAckRequired}
                    onChange={(e) => setFormAckRequired(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">
                    Acknowledgment Required
                  </span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDoc}
                disabled={!formTitle.trim() || uploadProgress === "uploading"}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {uploadProgress === "uploading"
                  ? "Uploading..."
                  : activeModal === "editDoc"
                    ? "Save Changes"
                    : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Folder Modal */}
      {(activeModal === "createFolder" || activeModal === "editFolder") && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {activeModal === "editFolder"
                  ? "Edit Folder"
                  : "Create Folder"}
              </h2>
              <button
                onClick={() => setActiveModal(null)}
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
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Folder name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Brief description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={folderVisibility}
                  onChange={(e) =>
                    setFolderVisibility(e.target.value as DocumentVisibility)
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Everyone</option>
                  <option value="managers">Managers Only</option>
                  <option value="admins">Admins Only</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFolder}
                disabled={!folderName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {activeModal === "editFolder" ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acknowledgments Modal */}
      {activeModal === "acknowledgments" && viewAckDocId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Acknowledgment Status
              </h2>
              <button
                onClick={() => {
                  setActiveModal(null);
                  setViewAckDocId(null);
                }}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">
                {acksForDoc.length} user(s) have acknowledged this document.
              </p>
              {acksForDoc.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No acknowledgments yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {acksForDoc.map((ack) => (
                    <div
                      key={ack.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="p-2 bg-green-100 rounded-full">
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {ack.user_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ack.user_email}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(ack.acknowledged_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {activeModal === "versionHistory" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Version History
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {mockVersionHistory.map((v, i) => (
                  <div key={v.version} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                          i === 0
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        v{v.version}
                      </div>
                      {i < mockVersionHistory.length - 1 && (
                        <div className="w-px h-full bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-gray-900">
                        {v.change_notes}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {v.uploaded_by} -- {formatDateTime(v.uploaded_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click-away overlay for context menus */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-[5]"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  );
}
