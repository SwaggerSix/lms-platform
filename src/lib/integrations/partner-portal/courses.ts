import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────
// Gotham course catalog export
//
// The gC Partner Portal pulls this catalog to populate its
// `gotham_courses` table (the source of "Gotham Course Certifications").
// The LMS is the system of record for the catalog; the portal upserts
// idempotently on `lms_course_id`, sets source='lms', and deactivates
// (never deletes) any lms row that stops appearing here.
//
// Where the gC vs GGS brand comes from
// ------------------------------------
// Courses in the LMS have no brand field. The branded catalog lives on
// storefront *products*: a product's storefront determines its Gotham
// brand. The two Gotham storefront slugs map to the portal `program`:
//     'gothamculture'    → 'gc'
//     'gothamgovernment' → 'ggs'
// ─────────────────────────────────────────────────────────────────

/** Storefront slug → portal program code. */
export const STOREFRONT_PROGRAM: Record<string, "gc" | "ggs"> = {
  gothamculture: "gc",
  gothamgovernment: "ggs",
};

/**
 * When the same course is mirrored into both storefronts (see
 * 20260612220000_mirror_catalogs.sql), we emit it once under a single
 * brand. gothamCulture (gc) wins.
 */
const PROGRAM_PRIORITY: Array<"gc" | "ggs"> = ["gc", "ggs"];

/** One course as the portal expects to upsert it into `gotham_courses`. */
export interface CanonicalGothamCourse {
  /** Stable idempotency key — the LMS product id. */
  lms_course_id: string;
  program: "gc" | "ggs";
  title: string;
  /** Product SKU if set, else null. */
  code: string | null;
  description: string | null;
  /** Always true here: only active catalog products are exported. */
  active: boolean;
}

export interface ProductRow {
  id: string;
  name: string | null;
  description: string | null;
  sku: string | null;
  storefront: { slug: string } | { slug: string }[] | null;
}

function slugOf(row: ProductRow): string | null {
  const s = Array.isArray(row.storefront) ? row.storefront[0] : row.storefront;
  return s?.slug ?? null;
}

/**
 * Map storefront product rows to the canonical Gotham course shape and dedupe.
 *
 * Dedupe rule: courses are grouped by case-insensitive title. A title that
 * appears under both storefronts is emitted once, under the higher-priority
 * brand (gc before ggs). Rows without a recognized Gotham storefront or a
 * non-empty title are skipped. Pure — no I/O — so it can be unit-tested.
 */
export function mapAndDedupeCourses(rows: ProductRow[]): CanonicalGothamCourse[] {
  const byTitle = new Map<string, CanonicalGothamCourse>();
  for (const row of rows) {
    const slug = slugOf(row);
    const program = slug ? STOREFRONT_PROGRAM[slug] : undefined;
    const title = (row.name ?? "").trim();
    if (!program || !title) continue;

    const key = title.toLowerCase();
    const existing = byTitle.get(key);
    const candidate: CanonicalGothamCourse = {
      lms_course_id: row.id,
      program,
      title,
      code: row.sku?.trim() || null,
      description: row.description ?? null,
      active: true,
    };

    if (!existing) {
      byTitle.set(key, candidate);
      continue;
    }
    // Keep the higher-priority brand for a dual-listed course.
    if (
      PROGRAM_PRIORITY.indexOf(candidate.program) <
      PROGRAM_PRIORITY.indexOf(existing.program)
    ) {
      byTitle.set(key, candidate);
    }
  }

  return Array.from(byTitle.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
}

/**
 * Build the deduped gC/GGS course catalog from active storefront products.
 * Manual portal rows are unaffected — the portal only touches rows it can
 * match by `lms_course_id`.
 */
export async function listGothamCourses(): Promise<CanonicalGothamCourse[]> {
  const service = createServiceClient();

  // Active products belonging to either Gotham storefront. `listed_in_storefront`
  // is intentionally NOT filtered: bespoke/B2B offerings stay active but unlisted
  // in the public store, and subcontractors still deliver them.
  const { data, error } = await service
    .from("products")
    .select("id, name, description, sku, storefront:storefronts!inner(slug)")
    .eq("status", "active")
    .in("storefront.slug", Object.keys(STOREFRONT_PROGRAM))
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Gotham course catalog query failed: ${error.message}`);
  }

  return mapAndDedupeCourses((data ?? []) as ProductRow[]);
}
