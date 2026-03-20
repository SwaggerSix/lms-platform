import { createServiceClient } from "@/lib/supabase/service";

interface CartItem {
  price: number;
  quantity: number;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_purchase: number | null;
  max_uses: number | null;
  current_uses: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

interface OrderTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

const TAX_RATE = 0; // Set to 0 for now; adjust per jurisdiction as needed

export function calculateOrderTotal(
  items: CartItem[],
  coupon?: Coupon | null
): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let discount = 0;
  if (coupon) {
    if (coupon.discount_type === "percentage") {
      discount = Math.round(subtotal * (coupon.discount_value / 100) * 100) / 100;
    } else {
      discount = Math.min(coupon.discount_value, subtotal);
    }
  }

  const taxable = subtotal - discount;
  const tax = Math.round(taxable * TAX_RATE * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  return { subtotal, discount, tax, total };
}

export async function validateCoupon(
  code: string,
  userId: string
): Promise<{ valid: boolean; coupon?: Coupon; reason?: string }> {
  const service = createServiceClient();

  const { data: coupon } = await service
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .single();

  if (!coupon) {
    return { valid: false, reason: "Coupon not found" };
  }

  if (!coupon.is_active) {
    return { valid: false, reason: "Coupon is no longer active" };
  }

  if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
    return { valid: false, reason: "Coupon has reached its usage limit" };
  }

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, reason: "Coupon is not yet valid" };
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, reason: "Coupon has expired" };
  }

  return { valid: true, coupon: coupon as Coupon };
}

export function formatPrice(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${datePart}-${randomPart}`;
}
