import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { StoreHeader } from "./store-header";
import type { Metadata } from "next";

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = createServiceClient();
  const { data: store } = await service
    .from("storefronts")
    .select("name, tagline")
    .eq("slug", slug)
    .single();
  return {
    title: store ? `${store.name} — Store` : "Store",
    description: store?.tagline || undefined,
  };
}

export default async function StoreLayout({ children, params }: StoreLayoutProps) {
  const { slug } = await params;
  const service = createServiceClient();

  const { data: store } = await service
    .from("storefronts")
    .select("id, slug, name, tagline, logo_url, branding, contact_email, announcement, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!store) notFound();

  const branding = (store.branding || {}) as { primary_color?: string; accent_color?: string };
  const primary = branding.primary_color || "#0f172a";
  const accent = branding.accent_color || "#2563eb";

  return (
    <div
      className="min-h-screen bg-white text-slate-900 flex flex-col"
      style={
        {
          "--store-primary": primary,
          "--store-accent": accent,
        } as React.CSSProperties
      }
    >
      {store.announcement && (
        <div
          className="text-center text-sm text-white py-2 px-4"
          style={{ backgroundColor: "var(--store-accent)" }}
        >
          {store.announcement}
        </div>
      )}
      <StoreHeader slug={store.slug} name={store.name} logoUrl={store.logo_url} />
      <main className="flex-1">{children}</main>
      <footer
        className="mt-16 py-10 px-6 text-sm text-white/80"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-white">{store.name}</div>
            {store.tagline && <div className="mt-1">{store.tagline}</div>}
          </div>
          {store.contact_email && (
            <a href={`mailto:${store.contact_email}`} className="hover:text-white underline-offset-4 hover:underline">
              {store.contact_email}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
