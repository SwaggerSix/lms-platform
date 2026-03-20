import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import crypto from "crypto";

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  branding: Record<string, unknown>;
  features: Record<string, unknown>;
  settings: Record<string, unknown>;
  plan: string;
  status: string;
}

/**
 * Resolve tenant from request: subdomain, custom domain, or X-Tenant-Slug header.
 */
export async function getTenantFromRequest(
  request: NextRequest
): Promise<TenantContext | null> {
  const service = createServiceClient();

  // 1. Check X-Tenant-Slug header (useful for API clients / local dev)
  const slugHeader = request.headers.get("x-tenant-slug");
  if (slugHeader) {
    const { data } = await service
      .from("tenants")
      .select("*")
      .eq("slug", slugHeader)
      .eq("status", "active")
      .single();
    return data ?? null;
  }

  // 2. Resolve from hostname
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0]; // strip port

  // 2a. Check custom domain
  if (hostname && !hostname.includes("localhost")) {
    const { data: byDomain } = await service
      .from("tenants")
      .select("*")
      .eq("domain", hostname)
      .eq("status", "active")
      .single();
    if (byDomain) return byDomain;
  }

  // 2b. Check subdomain (e.g., acme.lms-platform.com)
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain !== "www" && subdomain !== "app") {
      const { data: bySlug } = await service
        .from("tenants")
        .select("*")
        .eq("slug", subdomain)
        .eq("status", "active")
        .single();
      if (bySlug) return bySlug;
    }
  }

  return null;
}

/**
 * Get branding configuration for a tenant.
 */
export async function getTenantBranding(tenantId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("tenants")
    .select(
      "name, slug, logo_url, favicon_url, primary_color, secondary_color, branding"
    )
    .eq("id", tenantId)
    .single();

  if (error || !data) return null;

  return {
    name: data.name,
    slug: data.slug,
    logoUrl: data.logo_url,
    faviconUrl: data.favicon_url,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    loginBg: (data.branding as Record<string, unknown>)?.login_bg as string | undefined,
    heroText: (data.branding as Record<string, unknown>)?.hero_text as string | undefined,
    footerText: (data.branding as Record<string, unknown>)?.footer_text as string | undefined,
    customCss: (data.branding as Record<string, unknown>)?.custom_css as string | undefined,
  };
}

/**
 * Plan limits configuration.
 */
const PLAN_LIMITS: Record<string, { maxUsers: number; maxCourses: number }> = {
  free: { maxUsers: 10, maxCourses: 3 },
  starter: { maxUsers: 50, maxCourses: 20 },
  professional: { maxUsers: 500, maxCourses: 100 },
  enterprise: { maxUsers: Infinity, maxCourses: Infinity },
};

/**
 * Check if tenant is within plan limits for a given resource.
 */
export async function checkTenantLimits(
  tenantId: string,
  resource: "users" | "courses"
): Promise<{ allowed: boolean; current: number; max: number }> {
  const service = createServiceClient();

  const { data: tenant } = await service
    .from("tenants")
    .select("plan, max_users, max_courses")
    .eq("id", tenantId)
    .single();

  if (!tenant) return { allowed: false, current: 0, max: 0 };

  const planLimits = PLAN_LIMITS[tenant.plan] || PLAN_LIMITS.starter;

  if (resource === "users") {
    const max = tenant.max_users ?? planLimits.maxUsers;
    const { count } = await service
      .from("tenant_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    const current = count || 0;
    return { allowed: current < max, current, max };
  }

  if (resource === "courses") {
    const max = tenant.max_courses ?? planLimits.maxCourses;
    const { count } = await service
      .from("tenant_courses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    const current = count || 0;
    return { allowed: current < max, current, max };
  }

  return { allowed: false, current: 0, max: 0 };
}

/**
 * Generate a cryptographically secure invitation token.
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
