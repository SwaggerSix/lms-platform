import { CartClient } from "./cart-client";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CartClient slug={slug} />;
}
