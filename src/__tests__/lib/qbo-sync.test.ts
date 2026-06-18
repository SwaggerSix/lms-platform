import { describe, it, expect } from "vitest";
import {
  buildSalesReceiptEvent,
  buildRefundReceiptEvent,
  buildVendorBillEvent,
  classForStorefront,
  type OrderRecord,
  type OrderItemRecord,
  type InstructorPayoutRecord,
} from "@/lib/integrations/qbo-sync";

const order: OrderRecord = {
  id: "ord-1",
  order_number: "GC-1001",
  customer_email: "buyer@example.com",
  customer_name: "Jane Buyer",
  company_name: "Acme Federal",
  customer_phone: "555-1212",
  currency: "usd",
  subtotal: "1000.00",
  discount_amount: "100.00",
  tax_amount: "81.00",
  total: "981.00",
  refunded_amount: "0",
};

const items: OrderItemRecord[] = [
  { product_name: "Federal Acquisition Fundamentals", price: "895.00", quantity: 1 },
  { product_name: null, price: "50", quantity: 2, product: { name: "Add-on" } },
];

describe("classForStorefront", () => {
  it("maps each storefront slug to its QuickBooks Class", () => {
    expect(classForStorefront("gothamculture")).toBe("gothamCulture");
    expect(classForStorefront("gothamgovernment")).toBe("Gotham Government Services");
  });
  it("falls back to Unclassified for unknown or missing slugs", () => {
    expect(classForStorefront("mystery")).toBe("Unclassified");
    expect(classForStorefront(null)).toBe("Unclassified");
    expect(classForStorefront(undefined)).toBe("Unclassified");
  });
});

describe("buildSalesReceiptEvent", () => {
  const event = buildSalesReceiptEvent(order, items, "gothamculture");

  it("carries totals, discount and tax as numbers", () => {
    expect(event.subtotal).toBe(1000);
    expect(event.discount).toBe(100);
    expect(event.tax).toBe(81);
    expect(event.total).toBe(981);
    expect(event.currency).toBe("USD");
  });

  it("builds line items with computed amounts and name fallback", () => {
    expect(event.lines).toHaveLength(2);
    expect(event.lines[0]).toMatchObject({
      description: "Federal Acquisition Fundamentals",
      quantity: 1,
      unitAmount: 895,
      amount: 895,
    });
    // product_name null -> falls back to joined product.name; qty*price
    expect(event.lines[1]).toMatchObject({
      description: "Add-on",
      quantity: 2,
      unitAmount: 50,
      amount: 100,
    });
  });

  it("tags the receipt with the storefront's QuickBooks Class", () => {
    expect(event.qbClass).toBe("gothamCulture");
  });

  it("dedupes the customer on company name when present", () => {
    expect(event.customer.dedupeKey).toBe("company:acme federal");
    expect(event.customer.name).toBe("Acme Federal");
  });

  it("dedupes on email when there is no company", () => {
    const e = buildSalesReceiptEvent(
      { ...order, company_name: null },
      items,
      "gothamgovernment"
    );
    expect(e.customer.dedupeKey).toBe("email:buyer@example.com");
    expect(e.qbClass).toBe("Gotham Government Services");
  });

  it("produces a stable idempotency key per order", () => {
    expect(event.idempotencyKey).toBe("order:ord-1:sales_receipt");
  });
});

describe("buildRefundReceiptEvent", () => {
  it("carries the refunded amount and a refund-amount-scoped idempotency key", () => {
    const e = buildRefundReceiptEvent(order, "gothamculture", 250);
    expect(e.eventType).toBe("refund_receipt");
    expect(e.amount).toBe(250);
    expect(e.qbClass).toBe("gothamCulture");
    expect(e.idempotencyKey).toBe("order:ord-1:refund:250.00");
  });

  it("rounds the amount to cents", () => {
    const e = buildRefundReceiptEvent(order, null, 33.335);
    expect(e.amount).toBe(33.34);
    expect(e.idempotencyKey).toBe("order:ord-1:refund:33.34");
  });
});

describe("buildVendorBillEvent", () => {
  const payout: InstructorPayoutRecord = {
    id: "pay-9",
    amount: "626.50",
    order_id: "ord-1",
    instructor: {
      id: "usr-7",
      email: "coach@example.com",
      first_name: "Sam",
      last_name: "Coach",
    },
  };

  it("maps a payout to a vendor bill with AP amount and memo", () => {
    const e = buildVendorBillEvent(payout);
    expect(e.eventType).toBe("vendor_bill");
    expect(e.amount).toBe(626.5);
    expect(e.vendor.name).toBe("Sam Coach");
    expect(e.vendor.dedupeKey).toBe("email:coach@example.com");
    expect(e.memo).toContain("ord-1");
    expect(e.idempotencyKey).toBe("payout:pay-9:vendor_bill");
  });

  it("falls back to instructor id when no name or email", () => {
    const e = buildVendorBillEvent({
      ...payout,
      instructor: { id: "usr-7", email: null, first_name: null, last_name: null },
    });
    expect(e.vendor.name).toBe("Instructor usr-7");
    expect(e.vendor.dedupeKey).toBe("instructor:usr-7");
  });
});
