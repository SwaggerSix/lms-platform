import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import KnowledgeBaseClient from "./knowledge-base-client";
import type { KBCategoryView, KBArticleView } from "./knowledge-base-client";

export const metadata: Metadata = {
  title: "Knowledge Base | LMS Platform",
  description: "Search articles, FAQs, and guides in the knowledge base",
};

export default async function KnowledgeBasePage() {
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

  // Fetch articles and categories in parallel (same pattern as the API route)
  const [articlesResult, categoriesResult] = await Promise.all([
    service
      .from("kb_articles")
      .select(
        "*, category:kb_categories(*), author:users(id, email, first_name, last_name, avatar_url, role, job_title)"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    service
      .from("kb_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const rawArticles = articlesResult.data ?? [];
  const rawCategories = categoriesResult.data ?? [];

  // Map DB rows to the client component's expected shape
  const categories: KBCategoryView[] = rawCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description ?? "",
    icon: cat.icon ?? "FileText",
    articleCount: rawArticles.filter((a) => a.category_id === cat.id).length,
  }));

  const articles: KBArticleView[] = rawArticles.map((a) => {
    const cat = a.category as { id: string; name: string } | null;
    const author = a.author as { first_name: string | null; last_name: string | null } | null;
    const authorName = author
      ? [author.first_name, author.last_name].filter(Boolean).join(" ") || "Unknown"
      : "Unknown";

    return {
      id: a.id,
      categoryId: a.category_id ?? "",
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt ?? "",
      content: a.content,
      author: authorName,
      status: a.status,
      isFaq: a.is_faq,
      isPinned: a.is_pinned,
      viewCount: a.view_count,
      helpfulCount: a.helpful_count,
      notHelpfulCount: a.not_helpful_count,
      tags: a.tags ?? [],
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      categoryName: cat?.name ?? "Uncategorized",
    };
  });

  return <KnowledgeBaseClient categories={categories} articles={articles} />;
}
