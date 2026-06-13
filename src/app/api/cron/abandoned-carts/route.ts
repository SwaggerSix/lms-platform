import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/sender";
import { abandonedCartRecovery } from "@/lib/storefront/emails";

// Sends one recovery email per abandoned cart that is at least an hour old,
// has not been reminded, and has not converted to an order. Triggered on a
// schedule (see vercel.json) or manually with the cron bearer token.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://example.com";
const MIN_AGE_MINUTES = 60;
const MAX_AGE_HOURS = 72; // don't pester stale carts

export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const now = Date.now();
  const cutoffNew = new Date(now - MIN_AGE_MINUTES * 60 * 1000).toISOString();
  const cutoffOld = new Date(now - MAX_AGE_HOURS * 3600 * 1000).toISOString();

  const { data: carts } = await service
    .from("abandoned_carts")
    .select("id, storefront_id, email, customer_name, items, recovery_token, updated_at")
    .is("reminded_at", null)
    .is("recovered_at", null)
    .lte("updated_at", cutoffNew)
    .gte("updated_at", cutoffOld)
    .limit(200);

  let sent = 0;
  const storeCache = new Map<string, { name: string; slug: string; brandColor: string; contactEmail: string | null } | null>();

  for (const cart of carts || []) {
    let store = storeCache.get(cart.storefront_id);
    if (store === undefined) {
      const { data: s } = await service
        .from("storefronts")
        .select("name, slug, branding, contact_email, is_active")
        .eq("id", cart.storefront_id)
        .single();
      store = s && s.is_active
        ? {
            name: s.name,
            slug: s.slug,
            brandColor: (s.branding as { primary_color?: string } | null)?.primary_color || "#0f172a",
            contactEmail: s.contact_email,
          }
        : null;
      storeCache.set(cart.storefront_id, store);
    }
    if (!store) continue;

    const lines = (Array.isArray(cart.items) ? cart.items : []).map(
      (i: { name?: string; quantity?: number }) => ({
        name: i.name || "Course",
        quantity: i.quantity || 1,
      })
    );
    if (lines.length === 0) continue;

    const recoveryUrl = `${APP_URL}/store/${store.slug}/recover/${cart.recovery_token}`;
    const tpl = abandonedCartRecovery({
      storeName: store.name,
      brandColor: store.brandColor,
      customerName: cart.customer_name,
      recoveryUrl,
      lines,
    });

    const res = await sendEmail({
      to: cart.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: store.contactEmail || undefined,
    }).catch(() => ({ success: false as const }));

    if (res.success) {
      await service
        .from("abandoned_carts")
        .update({ reminded_at: new Date().toISOString() })
        .eq("id", cart.id);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, considered: carts?.length || 0, sent });
}
