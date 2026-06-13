import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/sender";
import { orderConfirmation, orderNotification, type OrderEmailData } from "./emails";

// Sends the buyer confirmation and the internal new-order notification for a
// completed storefront order. Safe to call more than once (Stripe retries
// webhooks) — it only sends when the order is in a completed state, and the
// caller guards against double-fulfilment.

export async function sendOrderEmails(
  service: SupabaseClient,
  orderId: string,
  appUrl: string
): Promise<void> {
  const { data: order } = await service
    .from("orders")
    .select(
      "order_number, company_name, customer_name, customer_email, customer_phone, po_number, order_notes, subtotal, discount_amount, tax_amount, total, currency, storefront_id"
    )
    .eq("id", orderId)
    .single();
  if (!order) return;

  const { data: store } = await service
    .from("storefronts")
    .select("name, slug, branding, tax_label, contact_email, order_notify_email")
    .eq("id", order.storefront_id)
    .single();
  if (!store) return;

  const { data: items } = await service
    .from("order_items")
    .select("product_name, price, quantity, product:products(name)")
    .eq("order_id", orderId);

  const brandColor =
    (store.branding as { primary_color?: string } | null)?.primary_color || "#0f172a";

  const lines = (items || []).map((it) => {
    const name =
      it.product_name ||
      (it.product as { name?: string } | null)?.name ||
      "Course";
    const unitPrice = Number(it.price);
    const quantity = it.quantity;
    return { name, quantity, unitPrice, lineTotal: unitPrice * quantity };
  });

  const data: OrderEmailData = {
    storeName: store.name,
    brandColor,
    orderNumber: order.order_number,
    companyName: order.company_name,
    customerName: order.customer_name || "there",
    customerEmail: order.customer_email || "",
    customerPhone: order.customer_phone,
    poNumber: order.po_number,
    orderNotes: order.order_notes,
    lines,
    subtotal: Number(order.subtotal ?? 0),
    discount: Number(order.discount_amount ?? 0),
    tax: Number(order.tax_amount ?? 0),
    taxLabel: store.tax_label || "Tax",
    total: Number(order.total ?? 0),
    currency: order.currency || "USD",
    manageUrl: `${appUrl}/admin/storefronts/${order.storefront_id}`,
  };

  // Buyer confirmation
  if (order.customer_email) {
    const tpl = orderConfirmation(data);
    await sendEmail({
      to: order.customer_email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: store.contact_email || undefined,
    }).catch((e) => console.error("Order confirmation email failed:", e));
  }

  // Internal notification
  const notifyTo = store.order_notify_email || store.contact_email;
  if (notifyTo) {
    const tpl = orderNotification(data);
    await sendEmail({
      to: notifyTo,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: order.customer_email || undefined,
    }).catch((e) => console.error("Order notification email failed:", e));
  }
}
