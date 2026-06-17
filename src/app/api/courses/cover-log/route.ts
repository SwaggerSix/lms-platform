import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { isProvenanceDocumented, storefrontNames, type EmbeddedProductRef } from "@/lib/courses/cover-provenance";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

/**
 * GET /api/courses/cover-log
 * Download an .xlsx audit log of every course cover image in use, with its
 * source and licensing status — proof that catalog images are cleared for use.
 */
export async function GET(_request: NextRequest) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data, error } = await service
    .from("courses")
    .select("id, title, slug, status, thumbnail_url, cover_source_url, cover_source_name, cover_license, cover_attribution, cover_origin, updated_at, products(storefront:storefronts(name, slug))")
    .not("thumbnail_url", "is", null)
    .order("title", { ascending: true });

  if (error) {
    console.error("cover-log error:", error.message);
    return NextResponse.json({ error: "Failed to build the log" }, { status: 500 });
  }

  type LogRow = {
    id: string | null; title: string | null; slug: string | null; status: string | null;
    thumbnail_url: string | null; cover_source_url: string | null; cover_source_name: string | null;
    cover_license: string | null; cover_attribution: string | null; cover_origin: string | null;
    updated_at: string | null;
    // `products` embeds as a single object (or null) because products.course_id
    // carries a UNIQUE constraint, so PostgREST treats it as a to-one relation.
    // Older code assumed an array; storefrontNames() normalizes either shape.
    products: EmbeddedProductRef | EmbeddedProductRef[] | null;
  };
  const rows = ((data ?? []) as unknown as LogRow[]).filter((c) => (c.thumbnail_url ?? "").trim().length > 0);

  const storefrontOf = (c: LogRow): string => storefrontNames(c.products);

  const aoa: (string | number)[][] = [[
    "Course Title", "Course ID", "Slug", "Status", "Storefront",
    "Image URL", "Source", "Source URL", "License", "Attribution",
    "Origin", "Documented?", "Last Updated",
  ]];

  for (const c of rows) {
    aoa.push([
      c.title ?? "",
      c.id ?? "",
      c.slug ?? "",
      c.status ?? "",
      storefrontOf(c),
      c.thumbnail_url ?? "",
      c.cover_source_name ?? "",
      c.cover_source_url ?? "",
      c.cover_license ?? "",
      c.cover_attribution ?? "",
      c.cover_origin ?? "",
      isProvenanceDocumented(c) ? "Yes" : "No",
      c.updated_at ? new Date(c.updated_at).toISOString().slice(0, 10) : "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 42 }, { wch: 38 }, { wch: 26 }, { wch: 10 }, { wch: 28 },
    { wch: 50 }, { wch: 18 }, { wch: 50 }, { wch: 24 }, { wch: 28 },
    { wch: 14 }, { wch: 14 }, { wch: 13 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cover Image Log");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="course-cover-image-log-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
