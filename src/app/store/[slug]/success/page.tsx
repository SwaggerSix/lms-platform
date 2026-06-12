import { createServiceClient } from "@/lib/supabase/service";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatPrice } from "@/lib/ecommerce/pricing";
import { ClearCart } from "./clear-cart";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { slug } = await params;
  const { order: orderNumber } = await searchParams;

  const service = createServiceClient();
  const { data: order } = orderNumber
    ? await service
        .from("orders")
        .select("order_number, status, total, currency, customer_email, metadata, items:order_items(id, price, quantity, product:products(name))")
        .eq("order_number", orderNumber)
        .single()
    : { data: null };

  const isTestMode = Boolean((order?.metadata as { test_mode?: boolean } | null)?.test_mode);

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <ClearCart slug={slug} />
      <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
      <h1 className="mt-5 text-3xl font-bold">Thank you for your order!</h1>
      {order ? (
        <>
          <p className="mt-3 text-slate-600">
            {order.status === "completed"
              ? "Your payment was received."
              : "Your payment is being confirmed — you'll get an email receipt shortly."}{" "}
            A confirmation has been sent to <strong>{order.customer_email}</strong>.
          </p>
          {isTestMode && (
            <p className="mt-3 inline-block rounded-full bg-amber-100 text-amber-800 text-sm px-4 py-1.5 font-medium">
              Test mode — no payment was charged
            </p>
          )}
          <div className="mt-8 rounded-2xl border border-slate-200 text-left p-6">
            <div className="text-sm text-slate-500">Order {order.order_number}</div>
            <div className="mt-3 divide-y divide-slate-100">
              {(order.items || []).map((item) => {
                // Supabase returns to-one joins as an object or single-element array
                const product = Array.isArray(item.product) ? item.product[0] : item.product;
                return (
                  <div key={item.id} className="py-2.5 flex justify-between text-sm">
                    <span>
                      {product?.name || "Course"}
                      {item.quantity > 1 && ` × ${item.quantity}`}
                    </span>
                    <span className="font-medium">{formatPrice(Number(item.price) * item.quantity)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between font-bold">
              <span>Total</span>
              <span>{formatPrice(Number(order.total), order.currency)}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-3 text-slate-600">
          Your order was received. A confirmation email is on its way.
        </p>
      )}
      <Link
        href={`/store/${slug}`}
        className="mt-10 inline-flex px-6 py-3 rounded-full text-white font-semibold"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        Continue browsing
      </Link>
    </div>
  );
}
