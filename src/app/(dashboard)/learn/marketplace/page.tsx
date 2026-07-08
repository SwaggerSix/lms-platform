import { redirect } from "next/navigation";

// The marketplace browse experience merged into the unified catalog
// (/learn/catalog, Partner tab). Old links land on the right tab.
export default function LearnMarketplacePage() {
  redirect("/learn/catalog?source=partner");
}
