import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import EcommerceAdminClient from "./ecommerce-admin-client";

export const metadata: Metadata = {
  title: "eCommerce | LMS Platform",
  description: "Manage products, orders, and revenue",
};

export default async function EcommerceAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || dbUser.role !== "admin" && dbUser.role !== "super_admin") redirect("/dashboard");

  // Fetch recent orders
  const { data: orders } = await service
    .from("orders")
    .select("*, order_items(*, product:products(*, course:courses(id, title, thumbnail_url)))")
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch products
  const { data: products } = await service
    .from("products")
    .select("*, course:courses(id, title, description, short_description, thumbnail_url, difficulty_level, estimated_duration, category:categories(id, name))")
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch courses for the create-product dropdown
  const { data: courses } = await service
    .from("courses")
    .select("id, title")
    .eq("status", "published")
    .order("title")
    .limit(100);

  return (
    <EcommerceAdminClient
      initialOrders={orders ?? []}
      initialProducts={products ?? []}
      initialCourses={courses ?? []}
    />
  );
}
