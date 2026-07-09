"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Upload, X } from "lucide-react";
import type { DocumentVisibility } from "@/types/database";
import type { DocumentWithUploader, FolderWithMeta } from "./documents-types";

interface DocumentFormModalProps {
  /** Non-null when editing; null for a new upload. */
  doc: DocumentWithUploader | null;
  folders: FolderWithMeta[];
  /** Folder preselected for new uploads (the currently open folder). */
  defaultFolderId: string;
  onClose: () => void;
  /** Called with the created/updated document; the parent updates its list. */
  onSaved: (doc: DocumentWithUploader) => void;
}

export default function DocumentFormModal({
  doc,
  folders,
  defaultFolderId,
  onClose,
  onSaved,
}: DocumentFormModalProps) {
  const toast = useToast();
  const isEdit = doc !== null;

  const [title, setTitle] = useState(doc?.title ?? "");
  const [description, setDescription] = useState(doc?.description ?? "");
  const [folderId, setFolderId] = useState(doc?.folder_id ?? defaultFolderId);
  const [tagsText, setTagsText] = useState(doc?.tags.join(", ") ?? "");
  const [visibility, setVisibility] = useState<DocumentVisibility>(doc?.visibility ?? "all");
  const [isPolicy, setIsPolicy] = useState(doc?.is_policy ?? false);
  const [ackRequired, setAckRequired] = useState(doc?.acknowledgment_required ?? false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectFile = (file: File) => {
    setUploadFile(file);
    setUploadProgress("idle");
    setUploadError(null);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  };

  const handleSave = async () => {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    let uploadFailed = false;

    try {
      if (isEdit) {
        const res = await fetch("/api/documents", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: doc.id,
            title,
            description,
            folder_id: folderId || null,
            tags,
            visibility,
            is_policy: isPolicy,
            acknowledgment_required: ackRequired,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update document");
        }
        const { data: updated } = await res.json();
        onSaved({
          ...doc,
          title,
          description,
          folder_id: folderId || null,
          tags,
          visibility,
          is_policy: isPolicy,
          acknowledgment_required: ackRequired,
          updated_at: updated?.updated_at ?? new Date().toISOString(),
        });
      } else {
        // Upload file first if one is selected
        let fileUrl = "#";
        let fileName = `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
        let fileType = "pdf";
        let fileSize = 0;
        let mimeType: string | null = null;

        if (uploadFile) {
          setUploadProgress("uploading");
          setUploadError(null);

          const uploadFormData = new FormData();
          uploadFormData.append("file", uploadFile);
          uploadFormData.append("bucket", "documents");
          if (folderId) {
            uploadFormData.append("folderId", folderId);
          }

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadFormData,
          });

          if (!uploadRes.ok) {
            const uploadErr = await uploadRes.json();
            setUploadProgress("error");
            setUploadError(uploadErr.error || "Upload failed");
            uploadFailed = true;
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
            folder_id: folderId || null,
            title,
            description,
            file_url: fileUrl,
            file_name: fileName,
            file_type: fileType,
            file_size: fileSize,
            mime_type: mimeType,
            tags,
            visibility,
            is_policy: isPolicy,
            acknowledgment_required: ackRequired,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create document");
        }
        const { data: created } = await res.json();
        onSaved({
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
        });
      }
      onClose();
    } catch (err) {
      if (!uploadFailed) {
        toast.error(err instanceof Error ? err.message : "An error occurred saving the document");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Document" : "Upload Document"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* File upload area (only for new uploads) */}
          {!isEdit && (
            <div>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) selectFile(droppedFile);
                }}
                className={cn(
                  "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  uploadFile
                    ? "border-primary-300 bg-primary-50"
                    : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                )}
              >
                {uploadFile ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-primary-500 mx-auto mb-2" />
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
                    <p className="text-xs text-gray-500 mt-1">
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
                    if (selected) selectFile(selected);
                    e.target.value = "";
                  }}
                />
              </label>
              {uploadProgress === "uploading" && (
                <p className="mt-2 text-sm text-primary-600 flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Document title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Brief description of the document"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="policy, compliance, training"
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

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPolicy}
                onChange={(e) => setIsPolicy(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-gray-700">Is Policy Document</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ackRequired}
                onChange={(e) => setAckRequired(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-gray-700">
                Acknowledgment Required
              </span>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || uploadProgress === "uploading"}
          >
            {uploadProgress === "uploading"
              ? "Uploading..."
              : isEdit
                ? "Save Changes"
                : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}
