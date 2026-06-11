import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { GemsClient } from "@/lib/integrations/gems/client";
import type { GemsConfig } from "@/lib/integrations/gems/types";
import CourseMappingClient from "./course-mapping-client";

export const metadata: Metadata = {
  title: "GEMS Course Mapping | LMS Platform",
  description: "Map existing LMS courses to GEMS course codes so the sync matches by code instead of creating duplicates.",
};

// Always render fresh — never cache the catalog response.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GemsCourseMappingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || (dbUser.role !== "admin" && dbUser.role !== "super_admin")) {
    redirect("/dashboard");
  }

  const { data: courses } = await service
    .from("courses")
    .select("id, title, slug, course_type, status, metadata")
    .neq("status", "archived")
    .order("title", { ascending: true });

  const courseRows = (courses ?? []).map((c) => ({
    id: c.id as string,
    title: c.title as string,
    slug: c.slug as string,
    course_type: (c.course_type ?? null) as string | null,
    status: (c.status ?? null) as string | null,
    gems_course_code:
      (((c.metadata as Record<string, unknown> | null) ?? {})["gems_course_code"] as
        | string
        | undefined) ?? null,
  }));

  // Server-side fetch the GEMS catalog so the dropdowns are populated on
  // initial render. This bypasses any client-side / service-worker cache
  // issues that were preventing the catalog from loading via fetch.
  let initialCatalog: Array<{ course_product_id: number; product_code: string; product_description: string }> = [];
  let catalogError: string | null = null;

  const { data: integration } = await service
    .from("external_integrations")
    .select("config, is_active")
    .eq("provider", "gems")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!integration) {
    catalogError = "No GEMS integration configured. Add one under Settings → Integrations.";
  } else if (!integration.is_active) {
    catalogError = "The GEMS integration exists but is not active. Activate it first.";
  } else {
    try {
      const client = new GemsClient(integration.config as unknown as GemsConfig);
      const catalog = await client.getCourseProducts();
      initialCatalog = catalog
        .map((c) => ({
          course_product_id: c.courseProductId,
          product_code: c.productCode,
          product_description: c.productDescription,
        }))
        .sort((a, b) => a.product_code.localeCompare(b.product_code));
    } catch (err) {
      catalogError = `Failed to load GEMS catalog: ${err instanceof Error ? err.message : "unknown error"}`;
    }
  }

  return (
    <CourseMappingClient
      initialCourses={courseRows}
      initialCatalog={initialCatalog}
      initialCatalogError={catalogError}
    />
  );
}
