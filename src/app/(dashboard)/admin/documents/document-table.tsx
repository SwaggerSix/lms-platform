"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  History,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { AcknowledgmentWithUser, DocumentWithUploader } from "./documents-types";
import { FileTypeIcon, fileTypeBadgeColor, formatDate, formatFileSize } from "./documents-shared";

const pageSize = 10;

interface DocumentTableProps {
  /** Filtered (but unpaginated) documents. */
  documents: DocumentWithUploader[];
  acknowledgments: AcknowledgmentWithUser[];
  selectedDocIds: Set<string>;
  currentPage: number;
  canManage: boolean;
  onPageChange: (page: number) => void;
  onToggleSelect: (docId: string) => void;
  onToggleSelectAll: () => void;
  onEditDocument: (doc: DocumentWithUploader) => void;
  onDeleteDocument: (docId: string) => void;
  onViewAcknowledgments: (docId: string) => void;
  onViewHistory: () => void;
}

export default function DocumentTable({
  documents,
  acknowledgments,
  selectedDocIds,
  currentPage,
  canManage,
  onPageChange,
  onToggleSelect,
  onToggleSelectAll,
  onEditDocument,
  onDeleteDocument,
  onViewAcknowledgments,
  onViewHistory,
}: DocumentTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize));
  const paginatedDocuments = documents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showStart = (currentPage - 1) * pageSize;
  const showEnd = Math.min(currentPage * pageSize, documents.length);

  const getPageNumbers = () => {
    const pages: number[] = [];
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={
                    documents.length > 0 &&
                    selectedDocIds.size === documents.length
                  }
                  onChange={onToggleSelectAll}
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
                const ackCount = acknowledgments.filter(
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
                        onChange={() => onToggleSelect(doc.id)}
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
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600">
                            <ShieldCheck className="h-3 w-3" />
                            Policy
                          </span>
                        )}
                        {doc.acknowledgment_required && (
                          <button
                            onClick={() => onViewAcknowledgments(doc.id)}
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
                              onEditDocument(doc);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              onViewHistory();
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
                                onViewAcknowledgments(doc.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Acknowledgments
                            </button>
                          )}
                          {canManage && (
                            <>
                              <hr className="my-1 border-gray-100" />
                              <button
                                onClick={() => {
                                  onDeleteDocument(doc.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </>
                          )}
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
      {documents.length > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            Showing {showStart + 1}-{showEnd} of {documents.length} documents
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            {getPageNumbers().map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium",
                  currentPage === p ? "bg-primary-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                {p}
              </button>
            ))}
            <Button
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
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
    </>
  );
}
