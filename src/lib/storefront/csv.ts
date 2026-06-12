// Tolerant product-catalog CSV parser. Accepts exports from Ecwid, Shopify,
// or a plain spreadsheet by matching common header names case-insensitively.

export interface ImportedProduct {
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  imageUrl: string | null;
  sku: string | null;
  externalId: string | null;
}

export interface ImportResult {
  products: ImportedProduct[];
  skipped: { row: number; reason: string }[];
}

// RFC 4180-style CSV parsing (quoted fields, embedded commas/newlines/quotes)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<keyof Omit<ImportedProduct, "price"> | "price", string[]> = {
  name: ["name", "title", "product name", "product_name", "product"],
  description: ["description", "body (html)", "body_html", "product description", "short description"],
  price: ["price", "variant price", "variant_price", "product price", "defaultdisplayedprice"],
  category: ["category", "categories", "type", "product category", "product type", "category 1"],
  imageUrl: ["image", "image url", "image_url", "image src", "image_src", "main image", "product image url", "media main image url"],
  sku: ["sku", "variant sku", "variant_sku", "product sku"],
  externalId: ["product id", "product_id", "id", "internal id", "handle", "product internal id"],
};

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseProductCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { products: [], skipped: [{ row: 0, reason: "File has no data rows" }] };
  }

  const headers = rows[0];
  const col = {
    name: findColumn(headers, HEADER_ALIASES.name),
    description: findColumn(headers, HEADER_ALIASES.description),
    price: findColumn(headers, HEADER_ALIASES.price),
    category: findColumn(headers, HEADER_ALIASES.category),
    imageUrl: findColumn(headers, HEADER_ALIASES.imageUrl),
    sku: findColumn(headers, HEADER_ALIASES.sku),
    externalId: findColumn(headers, HEADER_ALIASES.externalId),
  };

  if (col.name === -1) {
    return {
      products: [],
      skipped: [{ row: 1, reason: 'Could not find a "Name" or "Title" column in the file' }],
    };
  }

  const products: ImportedProduct[] = [];
  const skipped: ImportResult["skipped"] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const name = (cells[col.name] || "").trim();
    if (!name) {
      skipped.push({ row: r + 1, reason: "Missing product name" });
      continue;
    }

    const rawPrice = col.price !== -1 ? (cells[col.price] || "").trim() : "";
    const price = parseFloat(rawPrice.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(price) || price < 0) {
      skipped.push({ row: r + 1, reason: `Invalid price "${rawPrice}" for "${name}"` });
      continue;
    }

    const rawDesc = col.description !== -1 ? (cells[col.description] || "").trim() : "";
    products.push({
      name,
      description: rawDesc ? stripHtml(rawDesc) : null,
      price: Math.round(price * 100) / 100,
      category: col.category !== -1 ? (cells[col.category] || "").trim() || null : null,
      imageUrl: col.imageUrl !== -1 ? (cells[col.imageUrl] || "").trim() || null : null,
      sku: col.sku !== -1 ? (cells[col.sku] || "").trim() || null : null,
      externalId: col.externalId !== -1 ? (cells[col.externalId] || "").trim() || null : null,
    });
  }

  return { products, skipped };
}
