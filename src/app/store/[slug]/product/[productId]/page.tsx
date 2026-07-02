import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Clock, Check, Award } from "lucide-react";
import { formatPrice } from "@/lib/ecommerce/pricing";
import { AddToCart } from "./add-to-cart";
import { ProductGallery } from "./product-gallery";
import { ProductCard } from "../../catalog-client";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}): Promise<Metadata> {
  const { slug, productId } = await params;
  const service = createServiceClient();
  const { data: product } = await service
    .from("products")
    .select("name, description, image_url, category, storefront:storefronts(name)")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { title: "Course" };

  const storeName = (product.storefront as { name?: string } | null)?.name || "Store";
  const title = `${product.name} — ${storeName}`;
  const description = (product.description || product.category || "")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const images = product.image_url ? [{ url: product.image_url }] : undefined;

  return {
    title,
    description: description || undefined,
    alternates: { canonical: `/store/${slug}/product/${productId}` },
    openGraph: {
      title,
      description: description || undefined,
      type: "website",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description: description || undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const service = createServiceClient();

  const { data: store } = await service
    .from("storefronts")
    .select("id, slug, contact_email")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (!store) notFound();

  const { data: product } = await service
    .from("products")
    .select(
      "id, name, description, price, discount_price, discount_ends_at, image_url, image_urls, category, categories, duration_label, delivery_formats, logistics, min_participants, max_participants, status, learning_objectives, methodology, nasba_certified, nasba_cpe_credits, nasba_field_of_study, nasba_knowledge_level"
    )
    .eq("id", productId)
    .eq("storefront_id", store.id)
    .single();
  if (!product || product.status !== "active") notFound();

  const gallery: string[] = [
    ...(product.image_url ? [product.image_url] : []),
    ...((Array.isArray(product.image_urls) ? product.image_urls : []) as string[]),
  ].filter((v, i, a) => v && a.indexOf(v) === i);
  const logistics = (product.logistics || {}) as {
    lead_time?: string;
    coordinator_email?: string;
    coordinator_phone?: string;
    notes?: string;
  };
  const deliveryFormats: string[] = Array.isArray(product.delivery_formats)
    ? product.delivery_formats
    : [];
  const objectives: string[] = Array.isArray(product.learning_objectives)
    ? (product.learning_objectives as string[]).filter(Boolean)
    : [];
  const nasbaBits = [
    product.nasba_cpe_credits != null ? `${product.nasba_cpe_credits} CPE credits` : null,
    product.nasba_field_of_study || null,
    product.nasba_knowledge_level ? `${product.nasba_knowledge_level} level` : null,
  ].filter(Boolean) as string[];

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
        <ProductGallery images={gallery} fallbackLetter={(product.name || "?").charAt(0)} alt={product.name || ""} />

        <div>
          {product.category && (
            <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {product.category}
            </div>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{product.name}</h1>
          {(product.duration_label || deliveryFormats.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {product.duration_label && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  <Clock className="h-3.5 w-3.5" /> {product.duration_label}
                </span>
              )}
              {deliveryFormats.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {f}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-baseline gap-3">
            {price > 0 ? (
              <>
                <span className="text-3xl font-bold" style={{ color: "var(--store-primary)" }}>
                  {formatPrice(price)}
                </span>
                {onSale && (
                  <span className="text-lg text-slate-400 line-through">
                    {formatPrice(Number(product.price))}
                  </span>
                )}
              </>
            ) : (
              <span className="text-2xl font-bold" style={{ color: "var(--store-primary)" }}>
                Contact us for pricing
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-6 text-slate-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          )}

          {objectives.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">What you&apos;ll learn</h2>
              <ul className="space-y-2">
                {objectives.map((o, i) => (
                  <li key={i} className="flex gap-2 text-slate-700 leading-relaxed">
                    <Check className="h-4 w-4 mt-1 shrink-0" style={{ color: "var(--store-primary)" }} />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {product.methodology && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">How it&apos;s delivered</h2>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{product.methodology}</p>
            </div>
          )}

          {product.nasba_certified && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" style={{ color: "var(--store-primary)" }} />
                <h2 className="text-sm font-semibold text-slate-900">NASBA CPE credit</h2>
              </div>
              {nasbaBits.length > 0 && (
                <p className="mt-2 text-sm text-slate-700">{nasbaBits.join(" · ")}</p>
              )}
            </div>
          )}

          <div className="mt-8">
            {price > 0 ? (
              <AddToCart
                slug={slug}
                product={{
                  productId: product.id,
                  name: product.name || "Course",
                  price,
                  imageUrl: gallery[0] || null,
                  minSeats: product.min_participants ?? 1,
                  maxSeats: product.max_participants ?? null,
                }}
              />
            ) : (
              <a
                href={`mailto:${store.contact_email || "info@gothamculture.com"}?subject=${encodeURIComponent(
                  `Pricing inquiry: ${product.name || "Course"}`
                )}`}
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full text-white font-semibold text-base hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "var(--store-primary)" }}
              >
                Request pricing &amp; availability
              </a>
            )}
          </div>

          {(logistics.lead_time || logistics.coordinator_email || logistics.coordinator_phone || logistics.notes) && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Scheduling &amp; delivery</h2>
              <dl className="space-y-2 text-sm">
                {logistics.lead_time && (
                  <div className="flex gap-2"><dt className="text-slate-500 min-w-28">Lead time</dt><dd className="text-slate-800">{logistics.lead_time}</dd></div>
                )}
                {logistics.coordinator_email && (
                  <div className="flex gap-2"><dt className="text-slate-500 min-w-28">Coordinator</dt><dd className="text-slate-800"><a className="underline" href={`mailto:${logistics.coordinator_email}`}>{logistics.coordinator_email}</a></dd></div>
                )}
                {logistics.coordinator_phone && (
                  <div className="flex gap-2"><dt className="text-slate-500 min-w-28">Phone</dt><dd className="text-slate-800">{logistics.coordinator_phone}</dd></div>
                )}
                {logistics.notes && (
                  <div className="flex gap-2"><dt className="text-slate-500 min-w-28">Notes</dt><dd className="text-slate-800 whitespace-pre-line">{logistics.notes}</dd></div>
                )}
              </dl>
            </div>
          )}
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
