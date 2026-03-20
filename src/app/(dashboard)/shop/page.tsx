import { createServiceClient } from "@/lib/supabase/service";
import ShopClient from "./shop-client";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const service = createServiceClient();

  const page = parseInt(params.page || "1");
  const limit = 12;
  const offset = (page - 1) * limit;

  // Featured products
  const { data: featured } = await service
    .from("products")
    .select("*, course:courses(id, title, short_description, thumbnail_url, difficulty_level, estimated_duration, category:categories(id, name))")
    .eq("status", "active")
    .eq("is_featured", true)
    .order("sales_count", { ascending: false })
    .limit(4);

  // All products query
  let query = service
    .from("products")
    .select("*, course:courses(id, title, short_description, thumbnail_url, difficulty_level, estimated_duration, category:categories(id, name))", { count: "exact" })
    .eq("status", "active")
    .range(offset, offset + limit - 1);

  if (params.category) query = query.eq("course.category_id", params.category);
  if (params.search) {
    const s = (params.search || "").replace(/[%_\\'"()]/g, "");
    query = query.ilike("course.title", `%${s}%`);
  }

  const sort = params.sort || "newest";
  switch (sort) {
    case "price_asc": query = query.order("price", { ascending: true }); break;
    case "price_desc": query = query.order("price", { ascending: false }); break;
    case "popular": query = query.order("sales_count", { ascending: false }); break;
    default: query = query.order("created_at", { ascending: false });
  }

  const { data: products, count } = await query;

  // Categories for filter
  const { data: categories } = await service
    .from("categories")
    .select("id, name")
    .order("name");

  return (
    <ShopClient
      featured={featured || []}
      products={products || []}
      categories={categories || []}
      total={count || 0}
      page={page}
      totalPages={Math.ceil((count || 0) / limit)}
      currentSort={sort}
      currentCategory={params.category || ""}
      currentSearch={params.search || ""}
    />
  );
}
