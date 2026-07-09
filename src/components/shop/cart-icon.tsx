"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

export default function CartIcon() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/shop/cart");
        if (res.ok) {
          const data = await res.json();
          setCount(data.items?.length || 0);
        }
      } catch {
        // silently fail
      }
    }
    fetchCount();

    // Listen for custom cart update events
    const handler = () => fetchCount();
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, []);

  return (
    <Link
      href="/shop/cart"
      className="relative inline-flex items-center justify-center p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-gray-100 transition-colors"
      title="Shopping Cart"
    >
      <ShoppingCart className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-primary-600 rounded-full">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
