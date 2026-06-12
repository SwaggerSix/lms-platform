"use client";

import { useEffect } from "react";

// Empties the saved cart once the customer lands on the confirmation page.
export function ClearCart({ slug }: { slug: string }) {
  useEffect(() => {
    window.localStorage.removeItem(`storefront-cart:${slug}`);
  }, [slug]);
  return null;
}
