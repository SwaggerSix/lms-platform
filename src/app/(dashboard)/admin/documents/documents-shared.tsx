import { cn } from "@/utils/cn";
import { FileText, FileSpreadsheet, Presentation, Image } from "lucide-react";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FileTypeIcon({
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

export function fileTypeBadgeColor(fileType: string): string {
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
