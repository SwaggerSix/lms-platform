import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Middleware helper: resolves tenant from hostname or X-Tenant-Slug header
 * and injects tenant context into request headers for downstream handlers.
 */
export async function injectTenantContext(
  request: NextRequest
): Promise<NextResponse | null> {
  const service = createServiceClient();
  const headers = new Headers(request.headers);

  // Already resolved (e.g., nested middleware)
  if (headers.get("x-tenant-id")) return null;

  // 1. Check X-Tenant-Slug header
  const slugHeader = headers.get("x-tenant-slug");
  if (slugHeader) {
    const { data } = await service
      .from("tenants")
      .select("id, slug, status")
      .eq("slug", slugHeader)
      .single();

    if (!data) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }
    if (data.status === "suspended") {
      return NextResponse.json(
        { error: "Tenant is suspended" },
        { status: 403 }
      );
    }

    headers.set("x-tenant-id", data.id);
    headers.set("x-tenant-slug", data.slug);
    return null;
  }

  // 2. Resolve from hostname
  const host = headers.get("host") || "";
  const hostname = host.split(":")[0];

  // 2a. Custom domain lookup
  if (hostname && !hostname.includes("localhost")) {
    const { data: byDomain } = await service
      .from("tenants")
      .select("id, slug, status")
      .eq("domain", hostname)
      .single();

    if (byDomain) {
      if (byDomain.status === "suspended") {
        return NextResponse.json(
          { error: "Tenant is suspended" },
          { status: 403 }
        );
      }
      headers.set("x-tenant-id", byDomain.id);
      headers.set("x-tenant-slug", byDomain.slug);
      return null;
    }
  }

  // 2b. Subdomain lookup (e.g., acme.lms-platform.com)
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain !== "www" && subdomain !== "app") {
      const { data: bySub } = await service
        .from("tenants")
        .select("id, slug, status")
        .eq("slug", subdomain)
        .single();

      if (bySub) {
        if (bySub.status === "suspended") {
          return NextResponse.json(
            { error: "Tenant is suspended" },
            { status: 403 }
          );
        }
        headers.set("x-tenant-id", bySub.id);
        headers.set("x-tenant-slug", bySub.slug);
        return null;
      }
    }
  }

  // No tenant resolved — that's OK for platform-level routes
  return null;
}

/**
 * Extract tenant ID from request headers (set by middleware).
 */
export function getTenantIdFromHeaders(request: NextRequest): string | null {
  return request.headers.get("x-tenant-id");
}
