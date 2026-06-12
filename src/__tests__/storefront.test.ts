import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { parseCsv, parseProductCsv } from "@/lib/storefront/csv";
import { verifyWebhookSignature } from "@/lib/storefront/stripe";

describe("parseCsv", () => {
  it("handles quoted fields with commas, quotes, and newlines", () => {
    const rows = parseCsv('name,desc\n"Course, Advanced","She said ""go""\nnow"');
    expect(rows).toEqual([
      ["name", "desc"],
      ["Course, Advanced", 'She said "go"\nnow'],
    ]);
  });

  it("skips blank lines and handles CRLF", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");
    expect(rows).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });
});

describe("parseProductCsv", () => {
  it("imports an Ecwid-style export", () => {
    const csv = [
      "Product ID,Name,Description,DefaultDisplayedPrice,Category 1,SKU",
      '490653671,"Your Leadership Legacy","<p>A leadership program</p>",595.00,Leadership,GGS-001',
    ].join("\n");
    const { products, skipped } = parseProductCsv(csv);
    expect(skipped).toHaveLength(0);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      name: "Your Leadership Legacy",
      description: "A leadership program",
      price: 595,
      category: "Leadership",
      sku: "GGS-001",
      externalId: "490653671",
    });
  });

  it("imports a Shopify-style export", () => {
    const csv = [
      "Handle,Title,Body (HTML),Variant Price,Type",
      'leading-ei,"Leading with EI","Build skills",495,Conscious Leadership',
    ].join("\n");
    const { products } = parseProductCsv(csv);
    expect(products[0]).toMatchObject({
      name: "Leading with EI",
      price: 495,
      category: "Conscious Leadership",
      externalId: "leading-ei",
    });
  });

  it("skips rows with missing names or bad prices and strips currency symbols", () => {
    const csv = ["Name,Price", ",100", "Good Course,\"$1,234.50\"", "Bad Price,free"].join("\n");
    const { products, skipped } = parseProductCsv(csv);
    expect(products).toHaveLength(1);
    expect(products[0].price).toBe(1234.5);
    expect(skipped).toHaveLength(2);
  });

  it("rejects files without a name column", () => {
    const { products, skipped } = parseProductCsv("foo,bar\n1,2");
    expect(products).toHaveLength(0);
    expect(skipped[0].reason).toContain("Name");
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "whsec_test";
  const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });

  function sign(ts: number) {
    return crypto.createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  }

  it("accepts a valid signature", () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=${sign(ts)}`;
    const event = verifyWebhookSignature(payload, header, secret);
    expect(event?.type).toBe("checkout.session.completed");
  });

  it("rejects a tampered payload", () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=${sign(ts)}`;
    expect(verifyWebhookSignature(payload + "x", header, secret)).toBeNull();
  });

  it("rejects stale timestamps (replay protection)", () => {
    const ts = Math.floor(Date.now() / 1000) - 3600;
    const header = `t=${ts},v1=${sign(ts)}`;
    expect(verifyWebhookSignature(payload, header, secret)).toBeNull();
  });

  it("rejects a missing header", () => {
    expect(verifyWebhookSignature(payload, null, secret)).toBeNull();
  });
});
