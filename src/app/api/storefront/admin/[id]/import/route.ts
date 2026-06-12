import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { parseProductCsv } from "@/lib/storefront/csv";

// Catalog import: accepts a CSV exported from Ecwid, Shopify, or a plain
// spreadsheet and creates/updates the store's products. Re-importing the
// same file updates existing items (matched by external id, SKU, or name)
// instead of duplicating them.

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const service = createServiceClient();
  const { data: store } = await service
    .from("storefronts")
    .select("id")
    .eq("id", id)
    .single();
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const text = await request.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  }
  if (Buffer.byteLength(text) > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }

  const { products, skipped } = parseProductCsv(text);
  if (products.length === 0) {
    return NextResponse.json(
      {
        error:
          skipped[0]?.reason ||
          "No products found in the file. Make sure it has Name and Price columns.",
        skipped,
      },
      { status: 400 }
    );
  }

  const { data: existing } = await service
    .from("products")
    .select("id, name, sku, external_id")
    .eq("storefront_id", id);

  const byExternalId = new Map((existing || []).filter((p) => p.external_id).map((p) => [p.external_id as string, p.id]));
  const bySku = new Map((existing || []).filter((p) => p.sku).map((p) => [(p.sku as string).toLowerCase(), p.id]));
  const byName = new Map((existing || []).map((p) => [(p.name || "").toLowerCase(), p.id]));

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const p of products) {
    const matchId =
      (p.externalId && byExternalId.get(p.externalId)) ||
      (p.sku && bySku.get(p.sku.toLowerCase())) ||
      byName.get(p.name.toLowerCase());

    const record = {
      name: p.name,
      description: p.description,
      price: p.price,
      category: p.category,
      image_url: p.imageUrl,
      sku: p.sku,
      external_id: p.externalId,
      storefront_id: id,
    };

    if (matchId) {
      const { error } = await service
        .from("products")
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq("id", matchId);
      if (error) errors.push(`${p.name}: ${error.message}`);
      else updated++;
    } else {
      const { error } = await service
        .from("products")
        .insert({ ...record, status: "active" });
      if (error) errors.push(`${p.name}: ${error.message}`);
      else created++;
    }
  }

  return NextResponse.json({ created, updated, skipped, errors });
}
