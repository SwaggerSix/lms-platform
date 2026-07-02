import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Clock, Check, Award, Tag, Users, MonitorPlay, BookOpen, GraduationCap, CalendarClock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

  // Quick-fact tiles rendered in the "At a glance" panel under the course image.
  const groupSize =
    product.min_participants || product.max_participants
      ? product.min_participants && product.max_participants
        ? `${product.min_participants}–${product.max_participants} participants`
        : product.max_participants
          ? `Up to ${product.max_participants} participants`
          : `From ${product.min_participants} participants`
      : null;
  const facts: { icon: LucideIcon; label: string; value: string }[] = [
    product.duration_label ? { icon: Clock, label: "Duration", value: product.duration_label } : null,
    deliveryFormats.length > 0 ? { icon: MonitorPlay, label: "Delivery", value: deliveryFormats.join(", ") } : null,
    product.category ? { icon: Tag, label: "Category", value: product.category } : null,
    groupSize ? { icon: Users, label: "Group size", value: groupSize } : null,
    product.nasba_certified
      ? { icon: Award, label: "CPE credit", value: product.nasba_cpe_credits != null ? `${product.nasba_cpe_credits} NASBA CPE` : "NASBA certified" }
      : null,
  ].filter(Boolean) as { icon: LucideIcon; label: string; value: string }[];

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
        <div>
          <ProductGallery images={gallery} fallbackLetter={(product.name || "?").charAt(0)} alt={product.name || ""} />

          {facts.length > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">At a glance</h2>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-slate-100">
                {facts.map((f) => (
                  <div
                    key={f.label}
                    className="flex flex-col items-center gap-1.5 bg-white px-3 py-4 text-center"
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: "color-mix(in srgb, var(--store-primary) 10%, white)" }}
                    >
                      <f.icon className="h-[18px] w-[18px]" style={{ color: "var(--store-primary)" }} />
                    </span>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{f.label}</dt>
                    <dd className="text-sm font-bold text-slate-900 leading-snug">{f.value}</dd>
                  </div>
                ))}
                {facts.length % 2 === 1 && <div aria-hidden className="bg-white" />}
              </dl>
            </div>
          )}

          {product.nasba_certified && (
            <div
              className="mt-4 flex items-center gap-3 rounded-2xl border p-4"
              style={{
                borderColor: "color-mix(in srgb, var(--store-primary) 30%, white)",
                backgroundColor: "color-mix(in srgb, var(--store-primary) 5%, white)",
              }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "color-mix(in srgb, var(--store-primary) 12%, white)" }}
              >
                <Award className="h-5 w-5" style={{ color: "var(--store-primary)" }} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">NASBA CPE credit</h2>
                {nasbaBits.length > 0 && <p className="text-sm text-slate-700">{nasbaBits.join(" · ")}</p>}
              </div>
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {product.category}
            </div>
          )}
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{product.name}</h1>
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
          <div className="mt-6">
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

          {objectives.length > 0 && (
            <div className="mt-8 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                <GraduationCap className="h-4 w-4" style={{ color: "var(--store-primary)" }} />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">What you&apos;ll learn</h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {objectives.map((o, i) => (
                  <li key={i} className="flex gap-3 px-5 py-3 text-slate-700 leading-relaxed">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "color-mix(in srgb, var(--store-primary) 12%, white)" }}
                    >
                      <Check className="h-3 w-3" style={{ color: "var(--store-primary)" }} />
                    </span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {product.description && (
            <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                <BookOpen className="h-4 w-4" style={{ color: "var(--store-primary)" }} />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">About this course</h2>
              </div>
              <p className="px-5 py-4 text-slate-700 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {product.methodology && (
            <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                <MonitorPlay className="h-4 w-4" style={{ color: "var(--store-primary)" }} />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">How it&apos;s delivered</h2>
              </div>
              <p className="px-5 py-4 text-slate-700 leading-relaxed whitespace-pre-line">{product.methodology}</p>
            </div>
          )}

          {(logistics.lead_time || logistics.coordinator_email || logistics.coordinator_phone || logistics.notes) && (
            <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                <CalendarClock className="h-4 w-4" style={{ color: "var(--store-primary)" }} />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">Scheduling &amp; delivery</h2>
              </div>
              <dl className="space-y-2 px-5 py-4 text-sm">
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
