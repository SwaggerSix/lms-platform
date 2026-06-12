import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatPrice } from "@/lib/ecommerce/pricing";
import { AddToCart } from "./add-to-cart";
import { ProductCard } from "../../catalog-client";

export const revalidate = 60;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const service = createServiceClient();

  const { data: store } = await service
    .from("storefronts")
    .select("id, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (!store) notFound();

  const { data: product } = await service
    .from("products")
    .select("id, name, description, price, discount_price, discount_ends_at, image_url, category, status")
    .eq("id", productId)
    .eq("storefront_id", store.id)
    .single();
  if (!product || product.status !== "active") notFound();

  const onSale =
    product.discount_price != null &&
    (!product.discount_ends_at || new Date(product.discount_ends_at) > new Date());
  const price = onSale ? Number(product.discount_price) : Number(product.price);

  const { data: related } = await service
    .from("products")
    .select("id, name, description, price, discount_price, discount_ends_at, image_url, category, is_featured")
    .eq("storefront_id", store.id)
    .eq("status", "active")
    .eq("category", product.category || "")
    .neq("id", product.id)
    .limit(3);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link
        href={`/store/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-8"
      >
        <ChevronLeft className="h-4 w-4" /> All courses
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="rounded-2xl overflow-hidden bg-slate-100 aspect-[16/11]">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name || ""} className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center text-6xl font-bold text-white/90"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              {(product.name || "?").charAt(0)}
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {product.category}
            </div>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold" style={{ color: "var(--store-primary)" }}>
              {formatPrice(price)}
            </span>
            {onSale && (
              <span className="text-lg text-slate-400 line-through">
                {formatPrice(Number(product.price))}
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-6 text-slate-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          )}
          <div className="mt-8">
            <AddToCart
              slug={slug}
              product={{
                productId: product.id,
                name: product.name || "Course",
                price,
                imageUrl: product.image_url,
              }}
            />
          </div>
        </div>
      </div>

      {related && related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-4">You may also like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                slug={slug}
                product={{
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
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
