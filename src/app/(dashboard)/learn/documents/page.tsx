import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  // Fetch folders ordered by sort_order
  const { data: foldersData } = await service
    .from("document_folders")
    .select("*")
    .order("sort_order", { ascending: true });

  // Org-wide documents (user_id IS NULL) plus this learner's own personal
  // documents (e.g. course materials provisioned on enrollment).
  const [{ data: documentsData }, { data: acknowledgmentsData }] = await Promise.all([
    service
      .from("documents")
      .select("*")
      .or(`user_id.is.null,user_id.eq.${dbUser.id}`)
      .order("updated_at", { ascending: false }),
    service
      .from("document_acknowledgments")
      .select("document_id")
      .eq("user_id", dbUser.id),
  ]);

  const acknowledgedIds = new Set(
    (acknowledgmentsData ?? []).map((a: { document_id: string }) => a.document_id)
  );

  // Build folder list with document counts
  const documents: DocumentWithAcknowledgment[] = (documentsData ?? []).map(
    (doc: Document) => ({
      ...doc,
      acknowledged: acknowledgedIds.has(doc.id),
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
