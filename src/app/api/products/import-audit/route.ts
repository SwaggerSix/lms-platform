import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import * as XLSX from "xlsx";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Find a row value by a header that contains the given fragment (headers carry
// notes/asterisks, so we match loosely and case-insensitively).
function pick(row: Record<string, unknown>, fragment: string): string {
  const key = Object.keys(row).find((k) => k.toLowerCase().includes(fragment.toLowerCase()));
  if (!key) return "";
  const v = row[key];
  return v == null ? "" : String(v).trim();
}

function parseObjectives(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n|\s\|\s|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * POST /api/products/import-audit
 * Accepts the completed GGS catalog audit (.xlsx) and updates each product by
 * its Product ID. Only non-empty cells are applied (blank cells never wipe
 * existing data). The description-preview column is intentionally ignored so a
 * truncated preview can't overwrite the real description.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  let wb: XLSX.WorkBook;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "Could not read the spreadsheet" }, { status: 400 });
  }

  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("catalog")) ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return NextResponse.json({ error: "No data sheet found" }, { status: 400 });

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const service = createServiceClient();
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const id = pick(row, "product id");
    if (!UUID_RE.test(id)) { skipped++; continue; }

    const domain = pick(row, "domain");
    const objectives = parseObjectives(pick(row, "learning objectives"));
    const methodology = pick(row, "methodology");
    const duration = pick(row, "duration");

    // Only set fields that were actually filled in.
    const update: Record<string, unknown> = {};
    if (domain) update.category = domain;
    if (objectives.length) update.learning_objectives = objectives;
    if (methodology) update.methodology = methodology;
    if (duration) update.duration_label = duration;

    if (Object.keys(update).length === 0) { skipped++; continue; }
    update.updated_at = new Date().toISOString();

    const { error } = await service.from("products").update(update).eq("id", id);
    if (error) { errors.push(`${id}: ${error.message}`); continue; }
    updated++;
  }

  return NextResponse.json({
    updated,
    skipped,
    errors: errors.slice(0, 20),
    total_rows: rows.length,
  });
}
