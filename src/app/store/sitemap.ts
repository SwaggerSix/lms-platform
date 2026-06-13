import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/service";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://learn.gothamculture.com";

// Sitemap for the public storefronts: each active store plus every active
// product, so the migrated catalogs are discoverable by search engines.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const service = createServiceClient();

  const { data: stores } = await service
    .from("storefronts")
    .select("id, slug, updated_at")
    .eq("is_active", true);

  const entries: MetadataRoute.Sitemap = [];
  for (const store of stores || []) {
    entries.push({
      url: `${BASE}/store/${store.slug}`,
      lastModified: store.updated_at ? new Date(store.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });

    const { data: products } = await service
      .from("products")
      .select("id, updated_at")
      .eq("storefront_id", store.id)
      .eq("status", "active");

    for (const p of products || []) {
      entries.push({
        url: `${BASE}/store/${store.slug}/product/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
