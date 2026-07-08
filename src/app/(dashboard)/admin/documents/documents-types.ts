import type {
  Document,
  DocumentFolder,
  DocumentAcknowledgment,
} from "@/types/database";

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
