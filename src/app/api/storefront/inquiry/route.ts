import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/sender";
import { pricingInquiryNotification } from "@/lib/storefront/emails";

// Public "Request pricing & availability" inquiries from storefront course
// pages. Stores the inquiry and emails the store team (reply-to the
// requester). The inquiry is recorded even if the email fails to send.

const inquirySchema = z.object({
  storefront_slug: z.string().min(1),
  product_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  organization: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  seats_estimate: z.string().max(40).optional(),
  message: z.string().max(2000).optional(),
  // Honeypot: hidden field real users never fill in.
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success } = await rateLimit(`storefront-inquiry:${ip}`, 5, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  const data = parsed.data;
  // Honeypot tripped: pretend success, store nothing.
  if (data.website) return NextResponse.json({ ok: true });

  const service = createServiceClient();

  const { data: store } = await service
    .from("storefronts")
    .select("id, name, branding, contact_email, order_notify_email, notify_cc_email")
    .eq("slug", data.storefront_slug)
    .eq("is_active", true)
    .single();
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const { data: product } = await service
    .from("products")
    .select("id, name, status")
    .eq("id", data.product_id)
    .eq("storefront_id", store.id)
    .single();
  if (!product || product.status !== "active") {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { error: insertError } = await service.from("product_inquiries").insert({
    storefront_id: store.id,
    product_id: product.id,
    product_name: product.name || "Course",
    name: data.name,
    email: data.email,
    organization: data.organization || null,
    phone: data.phone || null,
    seats_estimate: data.seats_estimate || null,
    message: data.message || null,
  });
  if (insertError) {
    console.error("Inquiry insert failed:", insertError);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  // order_notify_email supports a comma-separated list of recipients.
  const notifyTo = store.order_notify_email || store.contact_email;
  const recipients = (notifyTo || "").split(/[,;\s]+/).filter(Boolean);
  if (recipients.length > 0) {
    const branding = (store.branding || {}) as { primary_color?: string };
    const tpl = pricingInquiryNotification({
      storeName: store.name || "Store",
      brandColor: branding.primary_color || "#0f172a",
      productName: product.name || "Course",
      name: data.name,
      email: data.email,
      organization: data.organization,
      phone: data.phone,
      seatsEstimate: data.seats_estimate,
      message: data.message,
    });
    // CC never duplicates a primary recipient.
    const cc = store.notify_cc_email && !recipients.includes(store.notify_cc_email) ? store.notify_cc_email : undefined;
    // sendEmail reports failures (e.g. no Resend key configured) via its return
    // value rather than throwing — log both paths so sends never fail silently.
    const result = await sendEmail({ to: recipients, cc, replyTo: data.email, ...tpl }).catch(
      (e): { success: false; error: string } => ({ success: false, error: String(e) })
    );
    if (!result.success) {
      console.error(`Inquiry notification email to ${recipients.join(", ")} failed:`, result.error);
    }
  }

  return NextResponse.json({ ok: true });
}
