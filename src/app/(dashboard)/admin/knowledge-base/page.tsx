import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import KnowledgeBaseClient from "./knowledge-base-client";
import type { AdminArticle, AdminCategory } from "./knowledge-base-client";

export default async function AdminKnowledgeBasePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch all articles (including drafts) with category and author joins
  const { data: articleRows } = await service
    .from("kb_articles")
    .select("*, category:kb_categories!category_id(id, name), author:users!author_id(id, first_name, last_name, email)")
    .order("created_at", { ascending: false });

  // Fetch all categories with article counts
  const { data: categoryRows } = await service
    .from("kb_categories")
    .select("*, kb_articles(id)")
    .order("sort_order", { ascending: true });

  // Map articles to the client-side shape
  const articles: AdminArticle[] = (articleRows ?? []).map((row: any) => {
    const cat = row.category as any;
    const auth = row.author as any;
    const authorName = auth
      ? `${auth.first_name ?? ""} ${auth.last_name ?? ""}`.trim() || auth.email || "Unknown"
      : "Unknown";

    return {
      id: row.id,
      title: row.title ?? "",
      slug: row.slug ?? "",
      categoryId: row.category_id ?? "",
      categoryName: cat?.name ?? "Uncategorized",
      status: row.status ?? "draft",
      isFaq: row.is_faq ?? false,
      isPinned: row.is_pinned ?? false,
      viewCount: row.view_count ?? 0,
      helpfulCount: row.helpful_count ?? 0,
      notHelpfulCount: row.not_helpful_count ?? 0,
      author: authorName,
      createdAt: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "",
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().split("T")[0] : "",
      excerpt: row.excerpt ?? "",
      content: row.content ?? "",
      tags: row.tags ?? [],
    };
  });

  // Map categories to the client-side shape
  const categories: AdminCategory[] = (categoryRows ?? []).map((row: any) => {
    const articleList = row.kb_articles as any[];
    return {
      id: row.id,
      name: row.name ?? "",
      description: row.description ?? "",
      icon: row.icon ?? "FileText",
      sortOrder: row.sort_order ?? 0,
      articleCount: articleList?.length ?? 0,
    };
  });

  return (
    <KnowledgeBaseClient
      initialArticles={articles}
      initialCategories={categories}
    />
  );
}
