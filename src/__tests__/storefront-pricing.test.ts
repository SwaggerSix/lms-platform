import { describe, it, expect } from "vitest";
import {
  calculateStorefrontPricing,
  bestVolumeTier,
  clampSeats,
  seatsWithinLimits,
  type VolumeTier,
} from "@/lib/storefront/pricing";

const tiers: VolumeTier[] = [
  { min_seats: 5, discount_percent: 5 },
  { min_seats: 10, discount_percent: 10 },
  { min_seats: 25, discount_percent: 15, is_active: false },
];

describe("bestVolumeTier", () => {
  it("returns the highest-percentage active tier the quantity qualifies for", () => {
    expect(bestVolumeTier(4, tiers)).toBeNull();
    expect(bestVolumeTier(5, tiers)?.discount_percent).toBe(5);
    expect(bestVolumeTier(12, tiers)?.discount_percent).toBe(10);
  });
  it("ignores inactive tiers", () => {
    // 30 seats would hit the 15% tier, but it's inactive → falls back to 10%
    expect(bestVolumeTier(30, tiers)?.discount_percent).toBe(10);
  });
});

describe("seat limits", () => {
  it("clamps requested seats to min/max", () => {
    expect(clampSeats(1, 10, 25)).toBe(10);
    expect(clampSeats(30, 10, 25)).toBe(25);
    expect(clampSeats(15, 10, 25)).toBe(15);
    expect(clampSeats(2, 10, null)).toBe(10);
  });
  it("validates seats within limits", () => {
    expect(seatsWithinLimits(9, 10, 25)).toBe(false);
    expect(seatsWithinLimits(10, 10, 25)).toBe(true);
    expect(seatsWithinLimits(26, 10, 25)).toBe(false);
    expect(seatsWithinLimits(1000, 10, null)).toBe(true);
  });
});

describe("calculateStorefrontPricing", () => {
  const off = { volumeDiscountsEnabled: false, volumeTiers: [], taxEnabled: false, taxRate: 0 };

  it("computes a plain subtotal with no discounts or tax", () => {
    const p = calculateStorefrontPricing([{ unitPrice: 100, quantity: 3 }], off);
    expect(p.subtotal).toBe(300);
    expect(p.discount).toBe(0);
    expect(p.tax).toBe(0);
    expect(p.total).toBe(300);
  });

  it("applies a per-line volume discount only when enabled", () => {
    const lines = [{ unitPrice: 100, quantity: 10 }];
    const disabled = calculateStorefrontPricing(lines, { ...off, volumeTiers: tiers });
    expect(disabled.volumeDiscount).toBe(0);

    const enabled = calculateStorefrontPricing(lines, {
      volumeDiscountsEnabled: true,
      volumeTiers: tiers,
      taxEnabled: false,
      taxRate: 0,
    });
    // 10 seats → 10% off 1000 = 100
    expect(enabled.volumeDiscount).toBe(100);
    expect(enabled.total).toBe(900);
  });

  it("stacks coupon after volume discount, then taxes the remainder", () => {
    const p = calculateStorefrontPricing(
      [{ unitPrice: 100, quantity: 10 }],
      { volumeDiscountsEnabled: true, volumeTiers: tiers, taxEnabled: true, taxRate: 0.1 },
      { discount_type: "percentage", discount_value: 10 }
    );
    // subtotal 1000, volume 100 → 900, coupon 10% of 900 = 90 → 810, tax 10% = 81 → 891
    expect(p.subtotal).toBe(1000);
    expect(p.volumeDiscount).toBe(100);
    expect(p.couponDiscount).toBe(90);
    expect(p.tax).toBe(81);
    expect(p.total).toBe(891);
  });

  it("caps a fixed coupon at the discounted subtotal", () => {
    const p = calculateStorefrontPricing(
      [{ unitPrice: 50, quantity: 1 }],
      off,
      { discount_type: "fixed", discount_value: 80 }
    );
    expect(p.couponDiscount).toBe(50);
    expect(p.total).toBe(0);
  });
});
