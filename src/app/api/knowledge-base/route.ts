import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { validateBody, createArticleSchema } from "@/lib/validations";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

/**
 * GET /api/knowledge-base
 * Query params: category, search, faq (true/false), slug
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const faqOnly = searchParams.get("faq") === "true";
  const slug = searchParams.get("slug");
  const service = createServiceClient();

  // Single article by slug
  if (slug) {
    const { data: article, error } = await service
      .from("kb_articles")
      .select("*, category:kb_categories(*), author:users(id, email, first_name, last_name, avatar_url, role, job_title)")
      .eq("slug", slug)
      .single();

    if (error || !article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({ article });
  }

  // Build articles query
  let articlesQuery = service
    .from("kb_articles")
    .select("*, category:kb_categories(*), author:users(id, email, first_name, last_name, avatar_url, role, job_title)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (category) {
    articlesQuery = articlesQuery.eq("category_id", category);
  }
  if (faqOnly) {
    articlesQuery = articlesQuery.eq("is_faq", true);
  }
  if (search) {
    const sanitizedSearch = search.replace(/[%_\\'"()]/g, "");
    articlesQuery = articlesQuery.or(
      `title.ilike.%${sanitizedSearch}%,excerpt.ilike.%${sanitizedSearch}%,content.ilike.%${sanitizedSearch}%`
    );
  }

  // Fetch articles and categories in parallel
  const [articlesResult, categoriesResult] = await Promise.all([
    articlesQuery,
    service.from("kb_categories").select("*").order("sort_order", { ascending: true }),
  ]);

  if (articlesResult.error) {
    console.error("Failed to fetch KB articles:", articlesResult.error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Add article_count to categories
  const articles = articlesResult.data ?? [];
  const categories = (categoriesResult.data ?? []).map((cat) => ({
    ...cat,
    article_count: articles.filter((a) => a.category_id === cat.id).length,
  }));

  return NextResponse.json({
    articles,
    categories,
    total: articles.length,
  });
}

/**
 * POST /api/knowledge-base
 * Create a new KB article or category (use type: 'category' for categories)
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const service = createServiceClient();

  // ── Create Category ──
  if (body.type === "category") {
    const { data, error } = await service
      .from("kb_categories")
      .insert({
        name: body.name,
        description: body.description || null,
        icon: body.icon || null,
        sort_order: body.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create KB category:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  // ── Create Article ──
  const validation = validateBody(createArticleSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data, error } = await service
    .from("kb_articles")
    .insert({
      category_id: body.category_id || null,
      title: body.title,
      slug: body.slug || body.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      content: body.content || "",
      excerpt: body.excerpt || null,
      author_id: body.author_id || null,
      status: body.status || "draft",
      is_faq: body.is_faq || false,
      is_pinned: body.is_pinned || false,
      tags: body.tags || [],
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create KB article:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/knowledge-base
 * Update an article or perform actions (increment_view, helpful, not_helpful)
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, action, ...updates } = body;
  const service = createServiceClient();

  // Actions that any authenticated user can perform
  if (action === "increment_view" || action === "helpful" || action === "not_helpful") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else {
    // All other PATCH operations require admin
    const auth = await authorize("admin");
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ── Update Category ──
  if (body.type === "category") {
    if (!id) {
      return NextResponse.json({ error: "Category ID required" }, { status: 400 });
    }
    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.icon !== undefined) updateFields.icon = body.icon;
    if (body.sort_order !== undefined) updateFields.sort_order = body.sort_order;

    const { data, error } = await service
      .from("kb_categories")
      .update(updateFields)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      console.error("Failed to update KB category:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  if (!id) {
    return NextResponse.json({ error: "Article ID required" }, { status: 400 });
  }

  if (action === "increment_view") {
    const { data, error } = await service.rpc("increment_field", {
      table_name: "kb_articles",
      field_name: "view_count",
      row_id: id,
    });
    // Fallback: just fetch and update manually
    if (error) {
      const { data: article } = await service
        .from("kb_articles")
        .select("view_count")
        .eq("id", id)
        .single();
      if (article) {
        await service
          .from("kb_articles")
          .update({ view_count: (article.view_count || 0) + 1 })
          .eq("id", id);
      }
    }
    const { data: updated } = await service
      .from("kb_articles")
      .select("*")
      .eq("id", id)
      .single();
    return NextResponse.json(updated);
  }

  if (action === "helpful") {
    const { data: article } = await service
      .from("kb_articles")
      .select("helpful_count")
      .eq("id", id)
      .single();
    if (article) {
      await service
        .from("kb_articles")
        .update({ helpful_count: (article.helpful_count || 0) + 1 })
        .eq("id", id);
    }
    const { data: updated } = await service
      .from("kb_articles")
      .select("*")
      .eq("id", id)
      .single();
    return NextResponse.json(updated);
  }

  if (action === "not_helpful") {
    const { data: article } = await service
      .from("kb_articles")
      .select("not_helpful_count")
      .eq("id", id)
      .single();
    if (article) {
      await service
        .from("kb_articles")
        .update({ not_helpful_count: (article.not_helpful_count || 0) + 1 })
        .eq("id", id);
    }
    const { data: updated } = await service
      .from("kb_articles")
      .select("*")
      .eq("id", id)
      .single();
    return NextResponse.json(updated);
  }

  // General update — whitelist allowed fields
  const allowedFields = ["title", "slug", "content", "category_id", "status", "tags", "excerpt"] as const;
  const safeUpdates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) safeUpdates[field] = updates[field];
  }

  const { data, error } = await service
    .from("kb_articles")
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    console.error("Failed to update KB article:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/knowledge-base
 * Query param: id
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }
  const service = createServiceClient();

  // ── Delete Category ──
  if (type === "category") {
    const { error } = await service
      .from("kb_categories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete KB category:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json({ success: true, deleted: id });
  }

  // ── Delete Article ──
  const { error } = await service
    .from("kb_articles")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete KB article:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: id });
}
