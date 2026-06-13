"use client";

import { useCallback, useEffect, useState } from "react";

// Guest cart stored in the browser (per storefront) so shoppers never need
// an account to fill a cart. Checkout re-validates everything server-side.

export interface StoreCartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number; // number of employee seats
  minSeats?: number;
  maxSeats?: number | null;
}

const cartKey = (storeSlug: string) => `storefront-cart:${storeSlug}`;
const CART_EVENT = "storefront-cart-changed";

export function readCart(storeSlug: string): StoreCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(cartKey(storeSlug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(storeSlug: string, items: StoreCartItem[]) {
  window.localStorage.setItem(cartKey(storeSlug), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { storeSlug } }));
}

// Replace the whole cart for a store (used when restoring an abandoned cart
// from a recovery link).
export function setCartItems(storeSlug: string, items: StoreCartItem[]) {
  if (typeof window === "undefined") return;
  writeCart(storeSlug, items);
}

export function useStoreCart(storeSlug: string) {
  const [items, setItems] = useState<StoreCartItem[]>([]);

  useEffect(() => {
    setItems(readCart(storeSlug));
    const onChange = () => setItems(readCart(storeSlug));
    window.addEventListener(CART_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CART_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [storeSlug]);

  const addItem = useCallback(
    (item: Omit<StoreCartItem, "quantity">, quantity?: number) => {
      const seats = quantity ?? item.minSeats ?? 1;
      const current = readCart(storeSlug);
      const existing = current.find((i) => i.productId === item.productId);
      const next = existing
        ? current.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + seats }
              : i
          )
        : [...current, { ...item, quantity: seats }];
      writeCart(storeSlug, next);
    },
    [storeSlug]
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      const current = readCart(storeSlug);
      const next =
        quantity <= 0
          ? current.filter((i) => i.productId !== productId)
          : current.map((i) => (i.productId === productId ? { ...i, quantity } : i));
      writeCart(storeSlug, next);
    },
    [storeSlug]
  );

  const removeItem = useCallback(
    (productId: string) => setQuantity(productId, 0),
    [setQuantity]
  );

  const clear = useCallback(() => writeCart(storeSlug, []), [storeSlug]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return { items, count, subtotal, addItem, setQuantity, removeItem, clear };
}
