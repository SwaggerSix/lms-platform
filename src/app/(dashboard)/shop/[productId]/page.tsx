import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import ProductDetailClient from "./product-detail-client";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const service = createServiceClient();

  const { data: product } = await service
    .from("products")
    .select("*, course:courses(id, title, description, short_description, thumbnail_url, difficulty_level, estimated_duration, course_type, category:categories(id, name), instructor_id)")
    .eq("id", productId)
    .single();

  if (!product) notFound();

  // Get instructor info
  let instructor = null;
  if (product.course?.instructor_id) {
    const { data } = await service
      .from("users")
      .select("id, first_name, last_name, role")
      .eq("id", product.course.instructor_id)
      .single();
    instructor = data;
  }

  // Related products (same category)
  let related: any[] = [];
  if (product.course?.category?.id) {
    const { data } = await service
      .from("products")
      .select("*, course:courses(id, title, short_description, thumbnail_url, difficulty_level, estimated_duration, category:categories(id, name))")
      .eq("status", "active")
      .eq("course.category_id", product.course.category.id)
      .neq("id", product.id)
      .limit(4);
    related = data || [];
  }

  return (
    <ProductDetailClient
      product={product}
      instructor={instructor}
      relatedProducts={related}
    />
  );
}
