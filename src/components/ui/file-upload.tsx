"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/utils/cn";
import {
  Upload,
  X,
  FileText,
  Image,
  Video,
  FileSpreadsheet,
  File,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "success" | "error";
  progress: number;
  url?: string;
  error?: string;
}

export interface FileUploadProps {
  /** Accepted file types (MIME types) */
  accept?: string[];
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Allow multiple files */
  multiple?: boolean;
  /** Maximum number of files */
  maxFiles?: number;
  /** Upload handler — receives the File and returns URL or error */
  onUpload: (file: File) => Promise<{ url?: string; error?: string }>;
  /** Callback when files change */
  onChange?: (files: UploadedFile[]) => void;
  /** Custom className */
  className?: string;
  /** Label text */
  label?: string;
  /** Helper text */
  helperText?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.startsWith("video/")) return Video;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return FileSpreadsheet;
  if (type.includes("pdf") || type.includes("document") || type.includes("word")) return FileText;
  return File;
}

export function FileUpload({
  accept,
  maxSize = 50 * 1024 * 1024,
  multiple = false,
  maxFiles = 10,
  onUpload,
  onChange,
  className,
  label,
  helperText,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateFiles = useCallback(
    (updater: (prev: UploadedFile[]) => UploadedFile[]) => {
      setFiles((prev) => {
        const next = updater(prev);
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const processFile = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID();
      const entry: UploadedFile = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "uploading",
        progress: 0,
      };

      // Validate size
      if (file.size > maxSize) {
        entry.status = "error";
        entry.error = `File too large (max ${formatSize(maxSize)})`;
        updateFiles((prev) => [...prev, entry]);
        return;
      }

      // Validate type
      if (accept && accept.length > 0 && !accept.includes(file.type)) {
        entry.status = "error";
        entry.error = "File type not accepted";
        updateFiles((prev) => [...prev, entry]);
        return;
      }

      // Add to list
      updateFiles((prev) => [...prev, entry]);

      // Simulate progress
      const progressInterval = setInterval(() => {
        updateFiles((prev) =>
          prev.map((f) =>
            f.id === id && f.status === "uploading"
              ? { ...f, progress: Math.min(90, f.progress + 10 + Math.random() * 20) }
              : f
          )
        );
      }, 200);

      // Upload
      const result = await onUpload(file);

      clearInterval(progressInterval);

      updateFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: result.error ? "error" : "success",
                progress: 100,
                url: result.url,
                error: result.error,
              }
            : f
        )
      );
    },
    [accept, maxSize, onUpload, updateFiles]
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const fileArray = Array.from(fileList);
      const remaining = maxFiles - files.length;
      const toProcess = fileArray.slice(0, remaining);
      toProcess.forEach(processFile);
    },
    [files.length, maxFiles, processFile]
  );

  const removeFile = useCallback(
    (id: string) => {
      updateFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [updateFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const acceptString = accept?.join(",");

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* Drop zone */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors",
          isDragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={label || "Upload files"}
      >
        <Upload className="h-8 w-8 text-gray-400" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-gray-700">
          {isDragging ? "Drop files here" : "Click to upload or drag and drop"}
        </p>
        {helperText && (
          <p className="mt-1 text-xs text-gray-500">{helperText}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple={multiple}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
          aria-hidden="true"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="mt-3 space-y-2" role="list" aria-label="Uploaded files">
          {files.map((file) => {
            const Icon = getFileIcon(file.type);
            return (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <Icon className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
                    {file.status === "uploading" && (
                      <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                    {file.error && (
                      <span className="text-xs text-red-600">{file.error}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {file.status === "uploading" && (
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" aria-label="Uploading" />
                  )}
                  {file.status === "success" && (
                    <CheckCircle className="h-4 w-4 text-green-500" aria-label="Upload complete" />
                  )}
                  {file.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-red-500" aria-label="Upload failed" />
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
