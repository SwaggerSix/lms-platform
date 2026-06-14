import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/sender";
import { orderConfirmation, orderNotification, type OrderEmailData } from "./emails";

// Sends the buyer confirmation and the internal new-order notification for a
// completed storefront order. Safe to call more than once (Stripe retries
// webhooks) â it only sends when the order is in a completed state, and the
// caller guards against double-fulfilment.

/**
 * Invites a new buyer (no existing LMS account) via Supabase Auth invite,
 * creates their `users` row, and enrolls them in the purchased courses.
 *
 * Returns:
 *   'invited'  â invite sent, user row created, enrollments upserted
 *   'pending'  â something failed; admin must create the account manually
 */
export async function inviteAndEnroll(
  service: SupabaseClient,
  orderId: string,
  existingMetadata: Record<string, unknown> | null,
  customerEmail: string,
  customerName: string | null,
  courseIds: string[]
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

    // 3. Enroll in each purchased course
    for (const courseId of courseIds) {
      await service.from("enrollments").upsert(
        {
          user_id: userId,
          course_id: courseId,
          status: "active",
          enrolled_at: now,
        },
        { onConflict: "user_id,course_id", ignoreDuplicates: true }
      );
    }

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
    await service
      .from("orders")
      .update({
        metadata: { ...(existingMetadata ?? {}), enrollment_status: "pending" },
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .catch((updateErr: unknown) =>
        console.error(
          "Could not stamp enrollment_status=pending on order",
          orderId,
          updateErr
        )
      );

    return "pending";
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
    enrollmentStatus: enrollmentStatus ?? null,
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
