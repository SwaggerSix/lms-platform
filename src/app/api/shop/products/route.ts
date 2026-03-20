import { authorize } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createProductSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") || "active";
  const featured = searchParams.get("featured");
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");
  const sort = searchParams.get("sort") || "newest";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");
  const offset = (page - 1) * limit;

  const service = createServiceClient();

  let query = service
    .from("products")
    .select("*, course:courses(id, title, description, short_description, thumbnail_url, difficulty_level, estimated_duration, category:categories(id, name))", { count: "exact" })
    .eq("status", status)
    .range(offset, offset + limit - 1);

  if (featured === "true") query = query.eq("is_featured", true);
  if (category) query = query.eq("course.category_id", category);
  if (minPrice) query = query.gte("price", parseFloat(minPrice));
  if (maxPrice) query = query.lte("price", parseFloat(maxPrice));

  if (search) {
    const sanitized = search.replace(/[%_\\'"()]/g, "");
    query = query.ilike("course.title", `%${sanitized}%`);
  }

  switch (sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "popular":
      query = query.order("sales_count", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Products API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    products: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`product-create-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(createProductSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Check course exists
  const { data: course } = await service.from("courses").select("id").eq("id", validation.data.course_id).single();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Check no existing product for this course
  const { data: existing } = await service.from("products").select("id").eq("course_id", validation.data.course_id).single();
  if (existing) return NextResponse.json({ error: "A product already exists for this course" }, { status: 409 });

  const { data, error } = await service.from("products").insert(validation.data).select().single();

  if (error) {
    console.error("Product create error:", error.message);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
