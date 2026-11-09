import type { SupabaseClient } from "@supabase/supabase-js";

// Coupon use counting for orders that complete without Stripe (a coupon that
// makes the order free). Those orders hand out courses on the spot, so the use
// must be claimed atomically BEFORE fulfilment: a read-then-write would let two
// people race a "max uses: 1" code and both get the bundle free.

/**
 * Takes one use of a coupon, or returns false when none is left. A compare-
 * and-set on current_uses, retried a few times so honest concurrent uses of an
 * unlimited (or roomy) code don't fail each other.
 */
export async function claimCouponUse(
  service: SupabaseClient,
  couponId: string,
  attempts = 3
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { data: c, error } = await service
      .from("coupons")
      .select("current_uses, max_uses, is_active")
      .eq("id", couponId)
      .maybeSingle();
    if (error || !c || !c.is_active) return false;
    const used = Number(c.current_uses ?? 0);
    if (c.max_uses && used >= Number(c.max_uses)) return false;
    const { data: claimed, error: updErr } = await service
      .from("coupons")
      .update({ current_uses: used + 1 })
      .eq("id", couponId)
      .eq("current_uses", used)
      .select("id");
    if (updErr) {
      console.error("Coupon claim failed:", updErr.message);
      return false;
    }
    if (claimed && claimed.length > 0) return true;
  }
  return false;
}

/** Gives back a use taken by claimCouponUse when the order then failed. */
export async function releaseCouponUse(service: SupabaseClient, couponId: string): Promise<void> {
  const { data: c } = await service
    .from("coupons")
    .select("current_uses")
    .eq("id", couponId)
    .maybeSingle();
  if (!c) return;
  const used = Number(c.current_uses ?? 0);
  if (used <= 0) return;
  const { error } = await service
    .from("coupons")
    .update({ current_uses: used - 1 })
    .eq("id", couponId)
    .eq("current_uses", used);
  if (error) console.error("Coupon release failed:", error.message);
}
