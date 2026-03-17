import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Document, DocumentFolder } from "@/types/database";
import DocumentsClient from "./documents-client";
import type { DocumentWithAcknowledgment, FolderWithMeta } from "./documents-client";

export const metadata: Metadata = {
  title: "Documents | LMS Platform",
  description: "Access and manage your learning documents and resources",
};

export default async function LearnerDocumentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  // Fetch folders ordered by sort_order
  const { data: foldersData } = await supabase
    .from("document_folders")
    .select("*")
    .order("sort_order", { ascending: true });

  // Fetch all documents ordered by most recently updated
  const { data: documentsData } = await supabase
    .from("documents")
    .select("*")
    .order("updated_at", { ascending: false });

  // Build folder list with document counts
  const documents: DocumentWithAcknowledgment[] = (documentsData ?? []).map(
    (doc: Document) => ({
      ...doc,
      acknowledged: false, // TODO: join with document_acknowledgments for current user
    })
  );

  const folders: FolderWithMeta[] = (foldersData ?? []).map(
    (folder: DocumentFolder) => ({
      ...folder,
      document_count:
        folder.document_count ??
        documents.filter((d) => d.folder_id === folder.id).length,
    })
  );

  return <DocumentsClient folders={folders} documents={documents} />;
}
