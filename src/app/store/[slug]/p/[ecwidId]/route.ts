import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Legacy Ecwid product URLs ended with "-p{numericId}". When a store is served
// from this app, those links 301 here so search rankings and bookmarks survive
// the migration: we resolve the product by its imported external_id (the Ecwid
// id) and forward to the canonical product page. Also consults explicit
// storefront_redirects entries as a fallback.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; ecwidId: string }> }
) {
  const { slug, ecwidId } = await context.params;
  const service = createServiceClient();

  const { data: store } = await service
    .from("storefronts")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!store) return NextResponse.redirect(new URL(`/store/${slug}`, request.url), 301);

  // Ecwid ids may arrive as "12345" or "Course-Name-p12345".
  const idMatch = ecwidId.match(/(\d{4,})$/);
  const externalId = idMatch ? idMatch[1] : ecwidId;

  const { data: product } = await service
    .from("products")
    .select("id")
    .eq("storefront_id", store.id)
    .eq("external_id", externalId)
    .maybeSingle();

  if (product) {
    return NextResponse.redirect(
      new URL(`/store/${slug}/product/${product.id}`, request.url),
      301
    );
  }

  const { data: redirect } = await service
    .from("storefront_redirects")
    .select("id, to_path, hits")
    .eq("storefront_id", store.id)
    .eq("from_path", `/p/${ecwidId}`)
    .maybeSingle();
  if (redirect) {
    await service
      .from("storefront_redirects")
      .update({ hits: (redirect.hits || 0) + 1 })
      .eq("id", redirect.id);
    return NextResponse.redirect(new URL(redirect.to_path, request.url), 301);
  }

  return NextResponse.redirect(new URL(`/store/${slug}`, request.url), 301);
}
