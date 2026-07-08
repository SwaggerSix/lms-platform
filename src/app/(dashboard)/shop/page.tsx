import { redirect } from "next/navigation";

// The shop browse experience merged into the unified catalog
// (/learn/catalog, Store tab). Product detail (/shop/[productId]), cart, and
// orders keep their existing routes.
export default function ShopPage() {
  redirect("/learn/catalog?source=store");
}
