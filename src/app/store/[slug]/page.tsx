import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { CatalogClient, type CatalogProduct } from "./catalog-client";

export const revalidate = 60;

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = createServiceClient();

  const { data: store } = await service
    .from("storefronts")
    .select("id, slug, name, tagline, description, hero_image_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (!store) notFound();

  const { data: products } = await service
    .from("products")
    .select("id, name, description, price, discount_price, discount_ends_at, image_url, category, is_featured, sales_count")
    .eq("storefront_id", store.id)
    .eq("status", "active")
    .order("sort_order")
    .order("name");

  const catalog: CatalogProduct[] = (products || []).map((p) => ({
    id: p.id,
    name: p.name || "Untitled",
    description: p.description,
    price: Number(p.price),
    discountPrice:
      p.discount_price != null &&
      (!p.discount_ends_at || new Date(p.discount_ends_at) > new Date())
        ? Number(p.discount_price)
        : null,
    imageUrl: p.image_url,
    category: p.category,
    isFeatured: p.is_featured,
  }));

  return (
    <div>
      <section
        className="relative text-white"
        style={{
          backgroundColor: "var(--store-primary)",
          backgroundImage: store.hero_image_url
            ? `linear-gradient(rgba(15,23,42,.7), rgba(15,23,42,.7)), url(${store.hero_image_url})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-3xl">
            {store.tagline || store.name}
          </h1>
          {store.description && (
            <p className="mt-4 text-white/85 text-lg max-w-2xl">{store.description}</p>
          )}
        </div>
      </section>
      <CatalogClient slug={store.slug} products={catalog} />
    </div>
  );
}
