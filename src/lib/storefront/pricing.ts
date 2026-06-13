// B2B storefront pricing. A line item is a course with a seat quantity (the
// number of employees the client is enrolling). Pricing applies, in order:
// per-line volume discounts (if the store enables them), then an order-level
// coupon, then optional tax. All money is rounded to cents at each step so the
// figure shown to the client matches what Stripe is asked to charge.

export interface VolumeTier {
  min_seats: number;
  discount_percent: number;
  is_active?: boolean;
}

export interface PricingCoupon {
  discount_type: "percentage" | "fixed";
  discount_value: number;
}

export interface PricingLine {
  unitPrice: number;
  quantity: number;
}

export interface StorefrontPricingConfig {
  volumeDiscountsEnabled: boolean;
  volumeTiers: VolumeTier[];
  taxEnabled: boolean;
  taxRate: number; // e.g. 0.0825 for 8.25%
}

export interface PricedLine extends PricingLine {
  lineSubtotal: number;
  volumeDiscountPercent: number;
  volumeDiscount: number;
}

export interface OrderPricing {
  lines: PricedLine[];
  subtotal: number;
  volumeDiscount: number;
  couponDiscount: number;
  discount: number; // volumeDiscount + couponDiscount
  tax: number;
  total: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The best (highest-percentage) active tier a seat count qualifies for. */
export function bestVolumeTier(
  quantity: number,
  tiers: VolumeTier[]
): VolumeTier | null {
  return (
    tiers
      .filter((t) => (t.is_active ?? true) && quantity >= t.min_seats)
      .sort((a, b) => b.discount_percent - a.discount_percent)[0] || null
  );
}

export function calculateStorefrontPricing(
  lines: PricingLine[],
  config: StorefrontPricingConfig,
  coupon?: PricingCoupon | null
): OrderPricing {
  const priced: PricedLine[] = lines.map((line) => {
    const lineSubtotal = round(line.unitPrice * line.quantity);
    const tier = config.volumeDiscountsEnabled
      ? bestVolumeTier(line.quantity, config.volumeTiers)
      : null;
    const volumeDiscountPercent = tier?.discount_percent ?? 0;
    const volumeDiscount = round(lineSubtotal * (volumeDiscountPercent / 100));
    return { ...line, lineSubtotal, volumeDiscountPercent, volumeDiscount };
  });

  const subtotal = round(priced.reduce((s, l) => s + l.lineSubtotal, 0));
  const volumeDiscount = round(priced.reduce((s, l) => s + l.volumeDiscount, 0));
  const afterVolume = round(subtotal - volumeDiscount);

  let couponDiscount = 0;
  if (coupon) {
    couponDiscount =
      coupon.discount_type === "percentage"
        ? round(afterVolume * (coupon.discount_value / 100))
        : Math.min(coupon.discount_value, afterVolume);
  }

  const taxable = round(afterVolume - couponDiscount);
  const tax = config.taxEnabled ? round(taxable * config.taxRate) : 0;
  const total = round(taxable + tax);

  return {
    lines: priced,
    subtotal,
    volumeDiscount,
    couponDiscount,
    discount: round(volumeDiscount + couponDiscount),
    tax,
    total,
  };
}

/** Clamp a requested seat count to a product's min/max participant limits. */
export function clampSeats(
  requested: number,
  min: number,
  max: number | null
): number {
  let q = Math.max(requested, min || 1);
  if (max != null) q = Math.min(q, max);
  return q;
}

export function seatsWithinLimits(
  quantity: number,
  min: number,
  max: number | null
): boolean {
  if (quantity < (min || 1)) return false;
  if (max != null && quantity > max) return false;
  return true;
}
