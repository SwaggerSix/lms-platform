"use client";

import { cn } from "@/utils/cn";
import { Modal } from "@/components/ui/modal";
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
    <Modal isOpen onClose={onClose} title="Version History" size="md">
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
    </Modal>
  );
}
