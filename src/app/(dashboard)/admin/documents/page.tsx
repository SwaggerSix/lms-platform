import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocumentsClient from "./documents-client";
import type {
  DocumentWithUploader,
  FolderWithMeta,
  AcknowledgmentWithUser,
  VersionHistoryEntry,
} from "./documents-client";

export default async function AdminDocumentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, role, organization_id")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch folders with document counts
  const { data: folderRows } = await supabase
    .from("document_folders")
    .select("*")
    .order("sort_order", { ascending: true });

  const folders: FolderWithMeta[] = (folderRows ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    parent_id: row.parent_id,
    organization_id: row.organization_id,
    visibility: row.visibility ?? "all",
    sort_order: row.sort_order ?? 0,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.created_at,
    document_count: 0,
  }));

  // Fetch documents with uploader join
  const { data: docRows } = await supabase
    .from("documents")
    .select("*, uploader:users!uploaded_by(id, first_name, last_name, email), folder:document_folders!folder_id(id, name)")
    .order("created_at", { ascending: false });

  const documents: DocumentWithUploader[] = (docRows ?? []).map((row: any) => {
    const uploaderObj = row.uploader as any;
    const uploaderName = uploaderObj
      ? `${uploaderObj.first_name ?? ""} ${uploaderObj.last_name ?? ""}`.trim() || uploaderObj.email || "Unknown"
      : "Unknown";

    return {
      id: row.id,
      folder_id: row.folder_id,
      title: row.title,
      description: row.description,
      file_url: row.file_url,
      file_name: row.file_name,
      file_type: row.file_type,
      file_size: row.file_size ?? 0,
      mime_type: row.mime_type ?? null,
      version: row.version ?? 1,
      tags: row.tags ?? [],
      organization_id: row.organization_id,
      visibility: row.visibility ?? "all",
      is_policy: row.is_policy ?? false,
      effective_date: row.effective_date ?? null,
      expiry_date: row.expiry_date ?? null,
      acknowledgment_required: row.acknowledgment_required ?? false,
      uploaded_by: row.uploaded_by,
      created_at: row.created_at,
      updated_at: row.updated_at ?? row.created_at,
      uploader_name: uploaderName,
    };
  });

  // Update folder document counts
  for (const folder of folders) {
    folder.document_count = documents.filter((d) => d.folder_id === folder.id).length;
  }

  // Fetch acknowledgments with user info
  const { data: ackRows } = await supabase
    .from("document_acknowledgments")
    .select("*, user:users!user_id(id, first_name, last_name, email)")
    .order("acknowledged_at", { ascending: false });

  const acknowledgments: AcknowledgmentWithUser[] = (ackRows ?? []).map((row: any) => {
    const u = row.user as any;
    const userName = u
      ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Unknown"
      : "Unknown";
    const userEmail = u?.email ?? "";

    return {
      id: row.id,
      document_id: row.document_id,
      user_id: row.user_id,
      acknowledged_at: row.acknowledged_at,
      user_name: userName,
      user_email: userEmail,
    };
  });

  // Version history is not stored in a separate table per the schema,
  // so we pass an empty array (the UI still renders the modal structure)
  const versionHistory: VersionHistoryEntry[] = [];

  return (
    <DocumentsClient
      initialFolders={folders}
      initialDocuments={documents}
      acknowledgments={acknowledgments}
      versionHistory={versionHistory}
    />
  );
}
