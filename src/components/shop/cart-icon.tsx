"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
      className="relative inline-flex items-center justify-center p-2 rounded-lg text-gray-600 hover:text-indigo-600 hover:bg-gray-100 transition-colors"
      title="Shopping Cart"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-indigo-600 rounded-full">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
