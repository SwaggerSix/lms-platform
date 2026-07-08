import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  type BrandingConfig,
  defaultBranding,
  deriveBrandShades,
} from "@/lib/branding";

// GET /api/branding
// Returns the effective branding for the current user: catalog defaults →
// platform_settings overrides → the user's tenant colors (tenants.primary_color
// and related fields set in the tenant Branding editor). This is what makes
// tenant white-labeling actually re-theme the app (UX review §3.3) — the
// branding store applies the result as --brand-* CSS variables, which the
// primary-* Tailwind ramp reads at runtime.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Platform-wide branding overrides
  let branding: BrandingConfig = { ...defaultBranding };
  const { data: settings } = await service
    .from("platform_settings")
    .select("value")
    .eq("key", "branding")
    .single();
  if (settings?.value && typeof settings.value === "object") {
    branding = { ...branding, ...(settings.value as Partial<BrandingConfig>) };
  }

  // Tenant overlay — platform admins are not tenant-scoped.
  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (profile && profile.role !== "admin" && profile.role !== "super_admin") {
    const { data: membership } = await service
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", profile.id)
      .limit(1)
      .maybeSingle();

    if (membership?.tenant_id) {
      const { data: tenant } = await service
        .from("tenants")
        .select("name, logo_url, favicon_url, primary_color, branding")
        .eq("id", membership.tenant_id)
        .single();

      if (tenant) {
        if (tenant.primary_color) {
          const shades = deriveBrandShades(tenant.primary_color);
          if (shades) branding = { ...branding, ...shades };
        }
        if (tenant.logo_url) branding.logoUrl = tenant.logo_url;
        if (tenant.favicon_url) branding.faviconUrl = tenant.favicon_url;
        if (tenant.name) branding.portalName = tenant.name;
        const tenantExtras = tenant.branding as { footer_text?: string } | null;
        if (tenantExtras?.footer_text) branding.footerText = tenantExtras.footer_text;
      }
    }
  }

  return NextResponse.json({ branding });
}
