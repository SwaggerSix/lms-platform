export interface Storefront {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  branding: { primary_color?: string; accent_color?: string };
  contact_email: string | null;
  announcement: string | null;
  is_active: boolean;
  order_notify_email: string | null;
  volume_discounts_enabled: boolean;
  tax_enabled: boolean;
  tax_rate: number;
  tax_label: string | null;
  analytics_measurement_id: string | null;
}

export interface Product {
  id: string;
  name: string | null;
  description: string | null;
  price: number;
  discount_price: number | null;
  category: string | null;
  duration_label: string | null;
  min_participants: number | null;
  max_participants: number | null;
  image_url: string | null;
  sku: string | null;
  status: string;
  is_featured: boolean;
  listed_in_storefront: boolean;
  sales_count: number;
}

export interface Order {
  id: string;
  order_number: string;
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  company_name: string | null;
  customer_phone: string | null;
  po_number: string | null;
  order_notes: string | null;
  admin_notes: string | null;
  total: number;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  refunded_amount: number | null;
  payment_method: string | null;
  payment_intent_id: string | null;
  currency: string | null;
  created_at: string;
  items: {
    id: string;
    price: number;
    quantity: number;
    product_name: string | null;
    product: { name: string | null } | null;
  }[];
}

/** Surface a transient success/error banner on the manage page. */
export type Notify = (kind: "ok" | "err", text: string) => void;

export const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
