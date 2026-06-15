/**
 * Shared helpers for course cover-image provenance — the licensing audit trail
 * that lets us prove every catalog image is cleared for use.
 */

export type CoverOrigin = "cc0" | "public_domain" | "original_ai" | "licensed" | "other";

const KNOWN_ORIGINS: CoverOrigin[] = ["cc0", "public_domain", "original_ai", "licensed", "other"];

export interface ProvenanceInput {
  origin?: string | null;
  license?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  attribution?: string | null;
}

/** Columns persisted on the courses row. */
export interface ProvenanceColumns {
  cover_source_url: string | null;
  cover_source_name: string | null;
  cover_license: string | null;
  cover_attribution: string | null;
  cover_origin: CoverOrigin;
}

/** Best-effort normalization of a free-text origin/license into our enum. */
export function normalizeOrigin(input: ProvenanceInput): CoverOrigin {
  const explicit = (input.origin || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (KNOWN_ORIGINS.includes(explicit as CoverOrigin)) return explicit as CoverOrigin;

  const hay = `${input.license || ""} ${input.sourceName || ""} ${input.origin || ""}`.toLowerCase();
  if (/\bai\b|ai[-\s]?generated|original|generated|dall|midjourney|stable\s?diffusion/.test(hay)) return "original_ai";
  if (/cc0|creative\s?commons\s?zero/.test(hay)) return "cc0";
  if (/public[\s-]?domain|pdm/.test(hay)) return "public_domain";
  if (/licen[sc]e|cc[\s-]?by|royalty/.test(hay)) return "licensed";
  return "other";
}

/** Build the courses-row column patch from raw provenance fields. */
export function buildProvenanceColumns(input: ProvenanceInput): ProvenanceColumns {
  const clean = (v: string | null | undefined) => {
    const s = (v ?? "").toString().trim();
    return s.length ? s : null;
  };
  return {
    cover_source_url: clean(input.sourceUrl),
    cover_source_name: clean(input.sourceName),
    cover_license: clean(input.license),
    cover_attribution: clean(input.attribution),
    cover_origin: normalizeOrigin(input),
  };
}

/** Cleared/empty provenance, used when a cover is removed. */
export function emptyProvenanceColumns(): ProvenanceColumns {
  return {
    cover_source_url: null,
    cover_source_name: null,
    cover_license: null,
    cover_attribution: null,
    cover_origin: "other",
  };
}

/**
 * Whether provenance is sufficient to count as "documented / cleared for use".
 * Originals (AI) and any row with both a license and a source/URL qualify.
 */
export function isProvenanceDocumented(cols: {
  cover_origin?: string | null;
  cover_license?: string | null;
  cover_source_url?: string | null;
  cover_source_name?: string | null;
}): boolean {
  if (cols.cover_origin === "original_ai") return true;
  const hasLicense = !!(cols.cover_license && cols.cover_license.trim());
  const hasSource = !!((cols.cover_source_url && cols.cover_source_url.trim()) ||
    (cols.cover_source_name && cols.cover_source_name.trim()));
  return hasLicense && hasSource;
}

/** Column headers for the bulk-import spreadsheet template. */
export const IMPORT_TEMPLATE_HEADERS = [
  "course_id",
  "slug",
  "image_url",
  "source_name",
  "license",
  "attribution",
  "origin",
] as const;
