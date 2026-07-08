"use client";

import { cn } from "@/utils/cn";
import { X } from "lucide-react";
import type { VersionHistoryEntry } from "./documents-types";
import { formatDateTime } from "./documents-shared";

interface VersionHistoryModalProps {
  versionHistory: VersionHistoryEntry[];
  onClose: () => void;
}

export default function VersionHistoryModal({
  versionHistory,
  onClose,
}: VersionHistoryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Version History
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {versionHistory.map((v, i) => (
              <div key={v.version} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      i === 0
                        ? "bg-primary-100 text-primary-700"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    v{v.version}
                  </div>
                  {i < versionHistory.length - 1 && (
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
  );
}
