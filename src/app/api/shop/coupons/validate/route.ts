import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, validateCouponSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { validateCoupon } from "@/lib/ecommerce/pricing";
import { jsonNoStore } from "@/lib/api/no-store";

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`coupon-validate-${auth.user.id}`, 15, 60000);
  if (!rl.success) return jsonNoStore({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(validateCouponSchema, body);
  if (!validation.success) return jsonNoStore({ error: validation.error }, { status: 400 });

  const result = await validateCoupon(validation.data.code, auth.user.id);

  if (!result.valid) {
    return jsonNoStore({ valid: false, reason: result.reason }, { status: 400 });
  }

  return jsonNoStore({
    valid: true,
    coupon: {
      code: result.coupon!.code,
      discount_type: result.coupon!.discount_type,
      discount_value: result.coupon!.discount_value,
    },
  });
}
