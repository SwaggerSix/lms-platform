import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/sender";
import { enrollInEntitlements, resolveOrderEntitlements, type FulfilmentItem } from "./bundles";
import { orderConfirmation, orderNotification, type OrderEmailData } from "./emails";

// Sends the buyer confirmation and the internal new-order notification for a
// completed storefront order. Safe to call more than once (Stripe retries
// webhooks) — it only sends when the order is in a completed state, and the
// caller guards against double-fulfilment.

/**
 * Invites a new buyer (no existing LMS account) via Supabase Auth invite,
 * creates their `users` row, and enrolls them in the purchased courses (and,
 * for a bundle, its learning path).
 *
 * Returns:
 *   'invited'  — invite sent, user row created, enrollments upserted
 *   'pending'  — something failed; admin must create the account manually
 */
export async function inviteAndEnroll(
  service: SupabaseClient,
  orderId: string,
  existingMetadata: Record<string, unknown> | null,
  customerEmail: string,
  customerName: string | null,
  entitlements: { courseIds: string[]; pathIds: string[] },
  storefrontId: string | null
): Promise<"invited" | "pending"> {
  // Split display name into first / last
  const trimmed = (customerName ?? "").trim();
  const spaceIdx = trimmed.indexOf(" ");
  const firstName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const lastName = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  try {
    // 1. Send the Auth invite
    const { data: inviteData, error: inviteError } =
      await service.auth.admin.inviteUserByEmail(customerEmail, {
        data: { first_name: firstName, last_name: lastName },
      });

    if (inviteError || !inviteData?.user) {
      throw inviteError ?? new Error("inviteUserByEmail returned no user");
    }

    const authId = inviteData.user.id;
    const now = new Date().toISOString();

    // 2. Upsert the public users row so the LMS can find it
    const { data: upserted, error: upsertError } = await service
      .from("users")
      .upsert(
        {
          auth_id: authId,
          email: customerEmail,
          first_name: firstName,
          last_name: lastName,
          role: "learner",
          status: "active",
          created_at: now,
          updated_at: now,
        },
        { onConflict: "email" }
      )
      .select("id")
      .single();

    if (upsertError || !upserted) {
      throw upsertError ?? new Error("users upsert returned no row");
    }

    const userId: string = upserted.id;

    // 3. Enroll in each purchased course (and learning path, for a bundle)
    await enrollInEntitlements(service, userId, entitlements, storefrontId, now);

    // 4. Stamp the order metadata so the history is self-describing
    await service
      .from("orders")
      .update({
        metadata: { ...(existingMetadata ?? {}), enrollment_status: "invited" },
        updated_at: now,
      })
      .eq("id", orderId);

    return "invited";
  } catch (err) {
    console.error("inviteAndEnroll failed for order", orderId, err);

    // Best-effort: record that manual intervention is needed
    const { error: metaUpdateErr } = await service
      .from("orders")
      .update({
        metadata: { ...(existingMetadata ?? {}), enrollment_status: "pending" },
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    if (metaUpdateErr) {
      console.error(
        "Could not stamp enrollment_status=pending on order",
        orderId,
        metaUpdateErr
      );
    }

    return "pending";
  }
}

/**
 * Test-mode orders (no Stripe keys) enroll the buyer everywhere except a live
 * Vercel production deployment, where missing keys mean a misconfiguration and
 * enrolling would give courses away.
 */
export function testModeEnrolls(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

/**
 * Gives a paid order's buyer what they bought: every course on the order, and
 * for a bundle line the learning path plus all of its courses. An existing LMS
 * account is enrolled directly; a new buyer is invited first. Idempotent —
 * enrollments the buyer already holds are left as they are, so a buyer who
 * owns some of a bundle's courses simply gets the rest.
 */
export async function enrollOrderBuyer(
  service: SupabaseClient,
  order: {
    id: string;
    customer_email: string | null;
    customer_name?: string | null;
    metadata?: unknown;
    storefront_id?: string | null;
  },
  items: FulfilmentItem[]
): Promise<"enrolled" | "invited" | "pending" | null> {
  if (!order.customer_email) return null;
  const entitlements = await resolveOrderEntitlements(service, items);
  const storefrontId = order.storefront_id ?? null;

  const { data: existingUser } = await service
    .from("users")
    .select("id")
    .eq("email", order.customer_email)
    .maybeSingle();

  if (existingUser) {
    await enrollInEntitlements(service, existingUser.id, entitlements, storefrontId);
    return "enrolled";
  }
  return inviteAndEnroll(
    service,
    order.id,
    (order.metadata as Record<string, unknown> | null) ?? null,
    order.customer_email,
    order.customer_name ?? null,
    entitlements,
    storefrontId
  );
}

/**
 * Adds a completed order's quantities to each product's sales count. Called
 * once per order, by whichever path completed it (the Stripe webhook after it
 * claims the order, or checkout for an order a coupon made free).
 */
export async function incrementSalesCounts(
  service: SupabaseClient,
  items: { product_id: string | null; quantity: number }[]
): Promise<void> {
  for (const item of items) {
    if (!item.product_id) continue;
    const { data: product } = await service
      .from("products")
      .select("sales_count")
      .eq("id", item.product_id)
      .single();
    if (product) {
      await service
        .from("products")
        .update({ sales_count: (product.sales_count ?? 0) + item.quantity })
        .eq("id", item.product_id);
    }
  }
}

export async function sendOrderEmails(
  service: SupabaseClient,
  orderId: string,
  appUrl: string,
  enrollmentStatus?: "enrolled" | "invited" | "pending" | null
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
    .select("name, slug, branding, tax_label, contact_email, order_notify_email, notify_cc_email")
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
    enrollmentStatus: enrollmentStatus ?? null,
  };

  // sendEmail reports failures (e.g. no Resend key configured) via its return
  // value rather than throwing — log both paths so sends never fail silently.
  const logFailure = (label: string, to: string) => (r: { success: boolean; error?: string }) => {
    if (!r.success) console.error(`${label} email to ${to} failed:`, r.error);
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
    })
      .then(logFailure("Order confirmation", order.customer_email))
      .catch((e) => console.error("Order confirmation email failed:", e));
  }

  // Internal notification. order_notify_email supports a comma-separated list;
  // CC never duplicates a primary recipient.
  const notifyTo = store.order_notify_email || store.contact_email;
  const recipients = (notifyTo || "").split(/[,;\s]+/).filter(Boolean);
  if (recipients.length > 0) {
    const tpl = orderNotification(data);
    await sendEmail({
      to: recipients,
      cc: store.notify_cc_email && !recipients.includes(store.notify_cc_email) ? store.notify_cc_email : undefined,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: order.customer_email || undefined,
    })
      .then(logFailure("Order notification", recipients.join(", ")))
      .catch((e) => console.error("Order notification email failed:", e));
  }
}
