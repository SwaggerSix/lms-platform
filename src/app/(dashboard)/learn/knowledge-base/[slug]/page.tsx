import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ArticleDetailClient from "./article-detail-client";
import type { ArticleData, RelatedArticle } from "./article-detail-client";
import { createServiceClient } from "@/lib/supabase/service";

export default async function KBArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const service = createServiceClient();

  // Fetch the article by slug with category and author joins
  const { data: rawArticle } = await service
    .from("kb_articles")
    .select(
      `
      id,
      category_id,
      title,
      slug,
      content,
      excerpt,
      status,
      is_faq,
      is_pinned,
      view_count,
      helpful_count,
      not_helpful_count,
      tags,
      created_at,
      updated_at,
      kb_categories (
        id,
        name
      ),
      users:author_id (
        id,
        first_name,
        last_name,
        job_title
      )
    `
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!rawArticle) {
    notFound();
  }

  const a = rawArticle as any;
  const category = a.kb_categories;
  const author = a.users;

  const article: ArticleData = {
    id: a.id,
    categoryId: a.category_id,
    categoryName: category?.name ?? "Uncategorized",
    title: a.title,
    slug: a.slug,
    content: a.content ?? "",
    excerpt: a.excerpt ?? "",
    author: author
      ? `${author.first_name} ${author.last_name}`
      : "Unknown Author",
    authorTitle: author?.job_title ?? "",
    status: a.status,
    isFaq: a.is_faq ?? false,
    isPinned: a.is_pinned ?? false,
    viewCount: a.view_count ?? 0,
    helpfulCount: a.helpful_count ?? 0,
    notHelpfulCount: a.not_helpful_count ?? 0,
    tags: a.tags ?? [],
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };

  // Fetch related articles from the same category
  const { data: rawRelated } = await service
    .from("kb_articles")
    .select("id, title, slug, view_count")
    .eq("category_id", article.categoryId)
    .eq("status", "published")
    .neq("id", article.id)
    .order("view_count", { ascending: false })
    .limit(4);

  const relatedArticles: RelatedArticle[] = (rawRelated ?? []).map(
    (r: any) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      viewCount: r.view_count ?? 0,
    })
  );

  return (
    <ArticleDetailClient
      article={article}
      relatedArticles={relatedArticles}
    />
  );
}
