"use client";

import { AlertTriangle, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { AcknowledgmentWithUser } from "./documents-types";
import { formatDateTime } from "./documents-shared";

interface AcknowledgmentsModalProps {
  /** Acknowledgments for the document being viewed. */
  acknowledgments: AcknowledgmentWithUser[];
  onClose: () => void;
}

export default function AcknowledgmentsModal({
  acknowledgments,
  onClose,
}: AcknowledgmentsModalProps) {
  return (
    <Modal isOpen onClose={onClose} title="Acknowledgment Status" size="md">
      <p className="text-sm text-gray-500 mb-4">
        {acknowledgments.length} user(s) have acknowledged this document.
      </p>
      {acknowledgments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No acknowledgments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {acknowledgments.map((ack) => (
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
              <p className="text-xs text-gray-500">
                {formatDateTime(ack.acknowledged_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
